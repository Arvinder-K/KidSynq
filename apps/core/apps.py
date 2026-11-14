import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from django.contrib.auth.signals import user_logged_in
        from django.contrib.auth.models import update_last_login
        from django.utils import timezone

        # Disconnect standard update_last_login to prevent DatabaseError on login
        user_logged_in.disconnect(update_last_login, dispatch_uid='update_last_login')

        def safe_update_last_login(sender, user, **kwargs):
            """
            Fault-tolerant signal receiver that updates last_login without
            crashing the login process if update_fields raises DatabaseError
            (e.g., when UUID formats differ in MySQL).
            """
            if not user or not getattr(user, 'pk', None):
                return
            now = timezone.now()
            user.last_login = now
            try:
                user.save(update_fields=['last_login'])
            except Exception as exc:
                logger.warning(
                    "Standard update_last_login failed for user %s: %s. Using raw update fallback.",
                    user.pk,
                    exc
                )
                try:
                    from django.db import connection
                    with connection.cursor() as cursor:
                        pk_str = str(user.pk)
                        pk_hex = user.pk.hex if hasattr(user.pk, 'hex') else pk_str.replace('-', '')
                        cursor.execute(
                            "UPDATE core_user SET last_login = %s WHERE id = %s OR id = %s",
                            [now, pk_str, pk_hex]
                        )
                except Exception as inner_exc:
                    logger.error("Fallback update_last_login also failed for user %s: %s", user.pk, inner_exc)

        user_logged_in.connect(safe_update_last_login, dispatch_uid='update_last_login')
