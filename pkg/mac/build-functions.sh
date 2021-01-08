_setup_env() {
    APP_RELEASE=`grep "^APP_RELEASE" web/config.py | cut -d"=" -f2 | sed 's/ //g'`
    APP_REVISION=`grep "^APP_REVISION" web/config.py | cut -d"=" -f2 | sed 's/ //g'`
    APP_NAME=`grep "^APP_NAME" web/config.py | cut -d"=" -f2 | sed "s/'//g" | sed 's/^ //'`
    APP_LONG_VERSION=${APP_RELEASE}.${APP_REVISION}
    APP_SHORT_VERSION=`echo ${APP_LONG_VERSION} | cut -d . -f1,2`
    APP_SUFFIX=`grep "^APP_SUFFIX" web/config.py | cut -d"=" -f2 | sed 's/ //g' | sed "s/'//g"`
    if [ ! -z ${APP_SUFFIX} ]; then
        APP_LONG_VERSION=${APP_LONG_VERSION}-${APP_SUFFIX}
    fi
    BUNDLE_DIR="${BUILD_ROOT}/${APP_NAME}.app"
}

_cleanup() {
    echo Cleaning up the old environment and app bundle...
    rm -rf "${BUILD_ROOT}"
    rm -rf "${TEMP_DIR}"
    rm -f ${DIST_ROOT}/*.dmg
}

_build_runtime() {
    echo "Assembling the runtime environment..."
    test -d "${BUILD_ROOT}" || mkdir "${BUILD_ROOT}"

    # Copy in the template application
    cd "${BUILD_ROOT}"
    yarn --cwd "${BUILD_ROOT}" add nw
    cp -R "${BUILD_ROOT}/node_modules/nw/nwjs/nwjs.app" "${BUILD_ROOT}/"
    mv "${BUILD_ROOT}/nwjs.app" "${BUNDLE_DIR}"

    # Copy in the runtime code
    mkdir "${BUNDLE_DIR}/Contents/Resources/app.nw/"
    cp -R "${SOURCE_DIR}/runtime/assets" "${BUNDLE_DIR}/Contents/Resources/app.nw/"
    cp -R "${SOURCE_DIR}/runtime/src" "${BUNDLE_DIR}/Contents/Resources/app.nw/"
    cp "${SOURCE_DIR}/runtime/package.json" "${BUNDLE_DIR}/Contents/Resources/app.nw/"

    # Install the runtime node_modules, then replace the package.json
    yarn --cwd "${BUNDLE_DIR}/Contents/Resources/app.nw/" install --production=true
}

_create_python_env() {
    echo "Creating the Python environment..."
    PATH=${PGADMIN_POSTGRES_DIR}/bin:${PATH}
    LD_LIBRARY_PATH=${PGADMIN_POSTGRES_DIR}/lib:${LD_LIBRARY_PATH}

    git clone https://github.com/gregneagle/relocatable-python.git "${BUILD_ROOT}/relocatable_python"
    PATH=$PATH:/usr/local/pgsql/bin "${BUILD_ROOT}/relocatable_python/make_relocatable_python_framework.py" --upgrade-pip --python-version ${PGADMIN_PYTHON_VERSION} --pip-requirements "${SOURCE_DIR}/requirements.txt" --destination "${BUNDLE_DIR}/Contents/Frameworks/"

    # Remove some things we don't need
    cd "${BUNDLE_DIR}/Contents/Frameworks/Python.framework"
    find . -name test -type d -print0 | xargs -0 rm -rf
    find . -name tkinter -type d -print0 | xargs -0 rm -rf
    find . -name turtle.py -type f -print0 | xargs -0 rm -rf
    find . -name turtledemo -type d -print0 | xargs -0 rm -rf
    find . -name tcl* -type d -print0 | xargs -0 rm -rf
    find . -name tk* -type d -print0 | xargs -0 rm -rf
    find . -name tdbc* -type d -print0 | xargs -0 rm -rf
    find . -name itcl* -type d -print0 | xargs -0 rm -rf
    rm -f Versions/Current/lib/Tk.*
    rm -f Versions/Current/lib/libtcl*.dylib
    rm -f Versions/Current/lib/libtk*.dylib
    rm -f Versions/Current/lib/tcl*.sh
    rm -f Versions/Current/lib/tk*.sh
    rm -rf Versions/Current/share
}

_build_docs() {
    echo "Building the docs..."
    # Create a temporary venv for the doc build, so we don't contaminate the one
    # that we're going to ship.
    "${BUNDLE_DIR}/Contents/Frameworks/Python.framework/Versions/Current/bin/python3" -m venv "${BUILD_ROOT}/venv"
    source "${BUILD_ROOT}/venv/bin/activate"
    pip3 install -r "${SOURCE_DIR}/requirements.txt"
    pip3 install sphinx

    cd "${SOURCE_DIR}"
    make docs

    cd "${SOURCE_DIR}/docs/en_US"
    test -d "${BUNDLE_DIR}/Contents/Resources/docs/en_US" || mkdir -p "${BUNDLE_DIR}/Contents/Resources/docs/en_US"
    cp -r _build/html "${BUNDLE_DIR}/Contents/Resources/docs/en_US/"

    # Remove some things we don't need
    rm -rf "${BUNDLE_DIR}/Contents/Resources/docs/en_US/html/_sources"
    rm -f "${BUNDLE_DIR}/Contents/Resources/docs/en_US/html/_static"/*.png
}

_fixup_imports() {
	  local todo todo_old fw_relpath lib lib_bn prefix

	  echo "Fixing imports on the core appbundle..."
	  pushd "$1" > /dev/null

	  # Find all the files that may need tweaks
	  todo=$(file `find . -perm +0111 -type f` | \
	      grep -v "Frameworks/Python.framework" | \
	      grep -v "Frameworks/nwjs" | \
	      grep -E "Mach-O 64-bit" | \
	      awk -F ':| ' '{ORS=" "; print $1}' | \
	      uniq)

    # Add anything in the site-packages Python directory
    todo+=$(file `find ./Contents/Frameworks/Python.framework/Versions/Current/lib/python*/site-packages -perm +0111 -type f` | \
        grep -E "Mach-O 64-bit" | \
        awk -F ':| ' '{ORS=" "; print $1}' | \
        uniq)

	  echo "Found executables: $todo"
	  while test "$todo" != ""; do
		    todo_old=$todo ;
		    todo="" ;
		    for todo_obj in $todo_old; do
			      echo "Post-processing: $todo_obj"

			      # Figure out the relative path from todo_obj to Contents/Frameworks
			      fw_relpath=$(echo "$todo_obj" | \
				        sed -n 's|^\(\.//*\)\(\([^/][^/]*/\)*\)[^/][^/]*$|\2|gp' | \
				        sed -n 's|[^/][^/]*/|../|gp' \
			          )"Contents/Frameworks"

      			# Find all libraries $todo_obj depends on, but skip system libraries
	  	    	for lib in $(
		    	    	otool -L $todo_obj | \
	    		    	sed -n 's|^.*[[:space:]]\([^[:space:]]*\.dylib\).*$|\1|p' | \
	    		    	egrep -v '^(/usr/lib)|(/System)|@executable_path' \
		  	    ); do
		  	        # Copy in any required dependencies
			    	    lib_bn="$(basename "$lib")" ;
				        if ! test -f "Contents/Frameworks/$lib_bn"; then
                    target_file=""
					          target_path=""
					          echo "Adding symlink: $lib_bn (because of: $todo_obj)"
					          cp -R "$lib" "Contents/Frameworks/$lib_bn"
					          if ! test -L "Contents/Frameworks/$lib_bn"; then
						            chmod 755 "Contents/Frameworks/$lib_bn"
					          else
						            target_file=$(readlink "$lib")
						            target_path=$(dirname "$lib")/$target_file
					              echo "Adding symlink target: $target_path"
		     				        cp "$target_path" "Contents/Frameworks/$target_file"
				    		        chmod 755 "Contents/Frameworks/$target_file"
					          fi
				       	    echo "Rewriting ID in Contents/Frameworks/$lib_bn to $lib_bn"
                    install_name_tool \
                        -id "$lib_bn" \
                        "Contents/Frameworks/$lib_bn" || exit 1
					          todo="$todo ./Contents/Frameworks/$lib_bn"
				        fi
				        # Rewrite the dependency paths
				        echo "Rewriting library $lib to @loader_path/$fw_relpath/$lib_bn in $todo_obj"
				        install_name_tool -change \
					          "$lib" \
					          "@loader_path/$fw_relpath/$lib_bn" \
					          "$todo_obj" || exit 1
                install_name_tool -change \
                    "$target_path" \
                    "@loader_path/$fw_relpath/$target_file" \
                    "$todo_obj" || exit 1
			      done
		    done
	  done

	  echo "Imports updated on the core appbundle."
	  popd > /dev/null
}

_complete_bundle() {
    echo "Completing the appbundle..."
    cd ${SCRIPT_DIR}

    # Copy the binary utilities into place
    mkdir -p "${BUNDLE_DIR}/Contents/SharedSupport/"
    cp "${PGADMIN_POSTGRES_DIR}/bin/pg_dump" "${BUNDLE_DIR}/Contents/SharedSupport/"
    cp "${PGADMIN_POSTGRES_DIR}/bin/pg_dumpall" "${BUNDLE_DIR}/Contents/SharedSupport/"
    cp "${PGADMIN_POSTGRES_DIR}/bin/pg_restore" "${BUNDLE_DIR}/Contents/SharedSupport/"
    cp "${PGADMIN_POSTGRES_DIR}/bin/psql" "${BUNDLE_DIR}/Contents/SharedSupport/"
    
    # Create the plist
    sed -i '' 's/<string>nwjs<\/string>/<string>pgAdmin 4<\/string>/g' "${BUNDLE_DIR}/Contents/Info.plist"

    # Icon
    cp pgAdmin4.icns "${BUNDLE_DIR}/Contents/Resources/app.icns"

    # Rename the executable
    mv "${BUNDLE_DIR}/Contents/MacOS/nwjs" "${BUNDLE_DIR}/Contents/MacOS/pgAdmin 4"

    # Import the dependencies, and rewrite any library references
		_fixup_imports "${BUNDLE_DIR}"

		# Fix the imports in psycopg2
		pushd "${BUNDLE_DIR}" > /dev/null
		PSYCOPG2_LIB=$(find . -name _psycopg.cpython*)
		popd > /dev/null

    # Build node modules
    pushd "${SOURCE_DIR}/web" > /dev/null
        yarn install
        yarn run bundle

        curl https://curl.haxx.se/ca/cacert.pem -o cacert.pem -s
    popd > /dev/null

    # copy the web directory to the bundle as it is required by runtime
    cp -r "${SOURCE_DIR}/web" "${BUNDLE_DIR}/Contents/Resources/"
    cd "${BUNDLE_DIR}/Contents/Resources/web"
    rm -f pgadmin4.db config_local.*
    rm -rf karma.conf.js package.json node_modules/ regression/ tools/ pgadmin/static/js/generated/.cache
    find . -name "tests" -type d -print0 | xargs -0 rm -rf
    find . -name "feature_tests" -type d -print0 | xargs -0 rm -rf
    find . -name ".DS_Store" -print0 | xargs -0 rm -f

    echo "SERVER_MODE = False" > config_distro.py
    echo "HELP_PATH = '../../../docs/en_US/html/'" >> config_distro.py
    echo "DEFAULT_BINARY_PATHS = {" >> config_distro.py
    echo "    'pg':   '\$DIR/../../SharedSupport'," >> config_distro.py
    echo "    'ppas': ''" >> config_distro.py
    echo "}" >> config_distro.py

    # License files
    cp -r ${SOURCE_DIR}/LICENSE "${BUNDLE_DIR}/Contents/"
    cp -r ${SOURCE_DIR}/DEPENDENCIES "${BUNDLE_DIR}/Contents/"

    # Remove the .pyc files if any
    find "${BUNDLE_DIR}" -name "*.pyc" -print0 | xargs -0 rm -f
}

_codesign_binaries() {
    if [ ${CODESIGN} -eq 0 ]; then
        return
    fi

    if [ -z "${DEVELOPER_ID}" ] ; then
        echo "Developer ID Application not found in codesign.conf" >&2
        exit 1
    fi

    if [ -z "${DEVELOPER_BUNDLE_ID}" ]; then
        echo "Developer Bundle Identifier not found in codesign.conf" >&2
    fi

    echo Signing ${BUNDLE_DIR} binaries...
    IFS=$'\n'
    for i in $(find "${BUNDLE_DIR}" -type f -perm +111 -exec file "{}" \; | grep -v "(for architecture" | grep -E "Mach-O executable|Mach-O 64-bit executable|Mach-O 64-bit bundle" | awk -F":" '{print $1}' | uniq)
    do
        codesign --deep --force --verify --verbose --timestamp --preserve-metadata=entitlements --options runtime -i "${DEVELOPER_BUNDLE_ID}" --sign "${DEVELOPER_ID}" "$i"
    done

    echo Signing ${BUNDLE_DIR} libraries...
    for i in $(find "${BUNDLE_DIR}" -type f -name "*.dylib*")
    do
        codesign --deep --force --verify --verbose --timestamp --preserve-metadata=entitlements --options runtime -i "${DEVELOPER_BUNDLE_ID}" --sign "${DEVELOPER_ID}" "$i"
    done
}

_codesign_bundle() {
    if [ ${CODESIGN} -eq 0 ]; then
        return
    fi

    # Sign the .app
    echo Signing ${BUNDLE_DIR}...
    codesign --deep --force --verify --verbose --timestamp --options runtime -i "${DEVELOPER_BUNDLE_ID}" --sign "${DEVELOPER_ID}" "${BUNDLE_DIR}"

    # Verify it worked
    echo Verifying the signature...
    codesign --verify --verbose --deep --force "${BUNDLE_DIR}"
    echo ${BUNDLE_DIR} successfully signed.
}

_create_dmg() {
    # move to the directory where we want to create the DMG
    test -d ${DIST_ROOT} || mkdir ${DIST_ROOT}
    cd ${DIST_ROOT}

    DMG_LICENCE=./../pkg/mac/licence.rtf
    DMG_VOLUME_NAME=${APP_NAME}
    DMG_NAME=`echo ${DMG_VOLUME_NAME} | sed 's/ //g' | awk '{print tolower($0)}'`
    DMG_IMAGE=${DMG_NAME}-${APP_LONG_VERSION}.dmg

    DMG_DIR=./${DMG_IMAGE}.src

    if test -e "${DMG_DIR}"; then
        echo "Directory ${DMG_DIR} already exists. Please delete it manually." >&2
        exit 1
    fi

    rm -f "${DMG_IMAGE}"
    mkdir "${DMG_DIR}"

    cp -R "${BUNDLE_DIR}" "${DMG_DIR}"

    echo "Creating image..."
    hdiutil create -quiet -srcfolder "$DMG_DIR" -fs HFS+ -format UDZO -volname "${DMG_VOLUME_NAME}" -ov "${DMG_IMAGE}"
    rm -rf "${DMG_DIR}"

    echo Attaching License to image...
    python ${SCRIPT_DIR}/dmg-license.py "${DMG_IMAGE}" "${DMG_LICENCE}" -c bz2
}

_codesign_dmg() {
    if [ ${CODESIGN} -eq 0 ]; then
        return
    fi

    DMG_VOLUME_NAME=${APP_NAME}
    DMG_NAME=`echo ${DMG_VOLUME_NAME} | sed 's/ //g' | awk '{print tolower($0)}'`
    DMG_IMAGE=${DIST_ROOT}/${DMG_NAME}-${APP_LONG_VERSION}.dmg

    if ! test -f "${DMG_IMAGE}" ; then
        echo "${DMG_IMAGE} is no disk image!" >&2
        exit 1
    fi

    # Sign the .app
    echo Signing ${DMG_IMAGE}...
    codesign --deep --force --verify --verbose --timestamp --options runtime -i "${DEVELOPER_BUNDLE_ID}" --sign "${DEVELOPER_ID}" "${DMG_IMAGE}"

    # Verify it worked
    echo Verifying the signature...
    codesign --verify --verbose --force "${DMG_IMAGE}"
    echo ${DMG_IMAGE} successfully signed.
}