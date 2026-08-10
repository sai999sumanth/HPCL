"""
settings.py — urdhva_base configuration loader.

Reads from a .alg_env file in the current working directory using
pydantic-settings. Every service (api_manager, vendor_ingestion_api, …)
keeps its own .alg_env with the values appropriate for that service.

All settings have safe defaults so the service can at least start up and
report meaningful errors rather than crashing at import time.
"""

import os
from typing import Any, Dict, List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl


class Settings(BaseSettings):
    """
    Central settings object. Values are read from (in priority order):
      1. Environment variables
      2. .alg_env file in the current working directory
      3. Defaults defined here
    """

    model_config = SettingsConfigDict(
        env_file=".alg_env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",           # allow unknown keys in .alg_env without errors
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "NOVEX"
    environment: str = "prod"

    # ── Database connections ──────────────────────────────────────────────────
    # Dict mapping connection-type label → list of DSN strings.
    # Example:
    #   db_urls = {
    #     "postgres_async": ["postgresql+asyncpg://host:5432/db?user=u&password=p"],
    #     "redis":          ["redis://localhost:6379"],
    #   }
    db_urls: Dict[str, List[Any]] = {
        "postgres_async": ["postgresql+asyncpg://localhost:5432/novex"],
        "redis": ["redis://localhost:6379"],
    }

    # ── Session / cookie ──────────────────────────────────────────────────────
    cookie_name: str = "ceg_session"
    session_httponly: bool = True
    # Must be False when running behind a plain-HTTP reverse proxy (nginx → uvicorn)
    session_secure: bool = False
    session_same_site: str = "lax"

    # ── Fernet key for cookie encryption ─────────────────────────────────────
    # Generate a fresh key:  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    fernet_key: str = "NjY5N2IwOWM5ZjE0MjMzN2M3YzA5Y2Y4ZDE4NTA2Mjk="

    # ── Payload encryption ────────────────────────────────────────────────────
    enable_encrypted_payload: bool = False
    disable_api_extra_inputs: bool = False

    # ── LDAP / Active Directory ───────────────────────────────────────────────
    ldap_host: str = "localhost"
    ldap_port: int = 389
    ldap_domain: str = "example.com"
    ldap_auth_enabled: bool = False
    # OpenLDAP token-based auth (used by some action files)
    openldap_auth_url: str = ""
    openldap_token_url: str = ""
    openldap_client_username: str = ""
    openldap_client_password: str = ""

    # ── JWT (mobile / app auth) ───────────────────────────────────────────────
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 1440          # 24 hours (used by urdhva_base internals)
    jwt_expiration_hours: int = 24          # alias used by users_actions.py login handler

    # ── Password / account security ───────────────────────────────────────────
    max_password_retires: int = 5           # note: original typo preserved for compatibility
    lockout_time: int = 300                 # seconds

    # ── Redis ─────────────────────────────────────────────────────────────────
    max_redis_connections: int = 20

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_per_minute: int = 1000

    # ── Logging ───────────────────────────────────────────────────────────────
    # Logger.getInstance() is called at module import time in elasticmodel.py,
    # so these MUST have defaults or the entire urdhva_base package fails to import.
    log_base_dir: str = "/var/log/ceg_sys_logs"
    log_max_size: int = 10 * 1024 * 1024   # 10 MB per log file
    log_max_count: int = 5                  # keep 5 rotated backup files

    # ── Elasticsearch / MongoDB index naming ──────────────────────────────────
    # Used as the base index/db name when constructing per-entity index names.
    default_index: str = "novex"

    # ── Audit logging ─────────────────────────────────────────────────────────
    auditlog_enabled: bool = False
    auditlog_queue_name: str = "auditlog"

    # ── Secret / password encryption ──────────────────────────────────────────
    password_salt: str = "urdhva_base_secret"

    # ── Master data in-memory cache ───────────────────────────────────────────
    default_masters_cache_seconds: int = 300   # 5 minutes

    # ── HTTP proxy (used by SAML/Azure AD MSAL client at MODULE LOAD time) ────
    # CRITICAL: accessed at module level in authenticator/saml_validation.py.
    # Missing defaults crash the import chain and kill the login route (404).
    http_proxy: str = ""
    https_proxy: str = ""

    # ── SAML / Azure AD OAuth2 ────────────────────────────────────────────────
    saml_tenant_id: str = ""
    saml_client_id: str = ""
    saml_client_secret: str = ""
    saml_redirect_uri: str = ""

    # ── Keycloak ──────────────────────────────────────────────────────────────
    keycloak_internal_url: str = "http://localhost:8080"
    keycloak_external_url: str = "http://localhost:8080"
    keycloak_auth_default: str = "/auth/"
    keycloak_admin: str = "admin"
    keycloak_password: str = "admin"

    # ── Roles / permissions ───────────────────────────────────────────────────
    roles_directories: str = ""

    # ── Camunda BPMN engine ───────────────────────────────────────────────────
    camunda_url: str = "http://localhost:8082"

    # ── File storage / upload paths ───────────────────────────────────────────
    uploads: str = "/var/log/ceg_sys_logs/uploads"
    download_path: str = "/var/log/ceg_sys_logs/downloads"
    downloads: str = "/var/log/ceg_sys_logs/downloads"
    downloads_url_base: str = "/downloads"
    ui_path: str = "/usr/share/nginx/html"

    # ── Device commissioning endpoints ────────────────────────────────────────
    commisioning_url: str = ""      # note: original typo preserved for compatibility
    decommisioning_url: str = ""    # note: original typo preserved for compatibility

    # ── Server metadata ───────────────────────────────────────────────────────
    server_ip: str = "localhost"

    # ── Misc ──────────────────────────────────────────────────────────────────
    debug: bool = False
    log_level: str = "info"


# Module-level singleton — imported everywhere as `urdhva_base.settings`
settings = Settings()
