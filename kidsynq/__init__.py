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
try:
    from django.db.models import UUIDField

    _orig_uuid_get_db_prep_value = UUIDField.get_db_prep_value

    def _resilient_uuid_get_db_prep_value(self, value, connection, prepared=False):
        if value is None:
            return None
        if not isinstance(value, uuid.UUID):
            try:
                value = self.to_python(value)
            except Exception:
                val_str = str(value)
                if len(val_str) == 36 and '-' in val_str:
                    return val_str.replace('-', '')
                return val_str
        if getattr(connection, 'vendor', None) == 'postgresql':
            return value
        # In MySQL, MariaDB, and SQLite, UUIDField columns are CHAR(32).
        # ALWAYS return 32-character hex to prevent (1406, "Data too long for column 'id'").
        return value.hex

    UUIDField.get_db_prep_value = _resilient_uuid_get_db_prep_value
except Exception:
    pass


# ==============================================================================
# Resilient ForeignKey Handling for Nullable Relations (Prevents DoesNotExist on dangling IDs)
# ==============================================================================
try:
    from django.db.models.fields.related_descriptors import ForwardManyToOneDescriptor

    _orig_get_object = ForwardManyToOneDescriptor.get_object

    def _safe_get_object(self, instance):
        try:
            return _orig_get_object(self, instance)
        except self.field.remote_field.model.DoesNotExist:
            if self.field.null:
                return None
            raise

    ForwardManyToOneDescriptor.get_object = _safe_get_object
except Exception:
    pass
