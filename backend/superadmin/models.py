from core.models import Daycare, User, SubscriptionPlan, DaycareSubscription

# ==========================================
# PROXY MODELS FOR DJANGO ADMIN GROUPING
# ==========================================
class ManagedDaycare(Daycare):
    class Meta:
        proxy = True
        verbose_name = 'Daycare Management'
        verbose_name_plural = '1. Daycare Management'

class ManagedUser(User):
    class Meta:
        proxy = True
        verbose_name = 'Platform User'
        verbose_name_plural = '2. Platform Users'

class ManagedSubscriptionPlan(SubscriptionPlan):
    class Meta:
        proxy = True
        verbose_name = 'Subscription Plan'
        verbose_name_plural = '3. Subscription Plans'

class ManagedDaycareSubscription(DaycareSubscription):
    class Meta:
        proxy = True
        verbose_name = 'Assigned Subscription'
        verbose_name_plural = '4. Assigned Subscriptions'
