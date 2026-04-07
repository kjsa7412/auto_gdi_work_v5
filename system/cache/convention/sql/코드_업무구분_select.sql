SELECT
    wrk_tp_cd,
    cd_tp_cd,
    cd_tp_nm,
    cd_tp_desc,
    use_yn,
    sys_yn
FROM sy_code_mst
WHERE use_yn = 'Y'
ORDER BY wrk_tp_cd, cd_tp_cd;
