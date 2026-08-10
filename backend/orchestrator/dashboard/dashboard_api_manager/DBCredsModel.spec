Model DBCredsInternal internal {
    skiprows optional int
    skipfooter optional int
    sheetno optional int
    delimiter optional str
    load_type optional str
}

Model DBCredsModel {
    name str
    cred_model str
    cred_type str
    host optional str
    port optional str
    username optional str
    password optional str
    database optional str
    service_name optional str
    sid optional str
    security_token optional str
    domain optional str
    enabled optional bool
    private_pass optional str
    private_key_pass optional str
    source_path optional str
    dest_path optional str
    file_pattern optional list str
    params optional DBCredsInternal

    Action=> load_dbcreds {

    }

    Config=> {
        collection_name=db_creds_model
  }
}
