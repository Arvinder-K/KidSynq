import os
import uuid

try:
    import pymysql
    # Ensure MySQLdb version requirement check passes across all environments
    if hasattr(pymysql, 'version_info') and pymysql.version_info < (2, 2, 1):
        pymysql.version_info = (2, 2, 8, "final", 0)
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

# ==============================================================================
# Resilient UUID handling for MySQL / MariaDB (GoDaddy & local compatibility)
# ==============================================================================
_DB_USES_HYPHENS = None


def _db_uses_hyphenated_uuids(connection):
    global _DB_USES_HYPHENS
    if _DB_USES_HYPHENS is not None:
        return _DB_USES_HYPHENS

    env_setting = os.environ.get('DB_UUID_HYPHENS')
    if env_setting is not None:
        _DB_USES_HYPHENS = env_setting.lower() in ('true', '1', 'yes')
        return _DB_USES_HYPHENS

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM core_user WHERE id LIKE '%-%' LIMIT 1")
            _DB_USES_HYPHENS = cursor.fetchone() is not None
    except Exception:
        _DB_USES_HYPHENS = False
    return _DB_USES_HYPHENS


try:
    from django.db.models import UUIDField

    _orig_uuid_get_db_prep_value = UUIDField.get_db_prep_value

    def _resilient_uuid_get_db_prep_value(self, value, connection, prepared=False):
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            value = self.to_python(value)
        if connection.features.has_native_uuid_field:
            return value
        if _db_uses_hyphenated_uuids(connection):
            return str(value)
        return value.hex

    UUIDField.get_db_prep_value = _resilient_uuid_get_db_prep_value
except Exception:
    pass
