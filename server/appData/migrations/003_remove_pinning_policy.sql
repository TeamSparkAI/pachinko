-- Remove pinning policy condition support (no longer evaluated; not applicable to webhook payloads)

DELETE FROM policies
WHERE name = 'Server Pinning Validation'
   OR (
        conditions IS NOT NULL
        AND json_valid(conditions)
        AND EXISTS (
            SELECT 1
            FROM json_each(conditions) AS jc
            WHERE json_extract(jc.value, '$.elementClassName') = 'pinning'
        )
    );

DELETE FROM policy_elements WHERE className = 'pinning';
