SELECT conname as name
FROM pg_catalog.pg_constraint ct
WHERE contype = 'c'
AND  ct.oid = {{cid}}::oid
