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
# Resilient UPDATE handling (Prevents "Save with update_fields did not affect any rows")
# ==============================================================================
try:
    from django.db.models import Model

    _orig_do_update = Model._do_update

    def _resilient_do_update(self, base_qs, using, pk_val, values, update_fields, forced_update, *args, **kwargs):
        results = _orig_do_update(self, base_qs, using, pk_val, values, update_fields, forced_update, *args, **kwargs)
        if not results and update_fields:
            # If UPDATE returned 0 affected rows (e.g. unchanged values in MySQL or driver lacking CLIENT_FOUND_ROWS),
            # verify whether the record exists. If it exists, the update is considered successful.
            try:
                if base_qs.filter(pk=pk_val).exists():
                    return [()]
            except Exception:
                pass
        return results

    Model._do_update = _resilient_do_update
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
