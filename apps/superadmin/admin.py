from django.contrib import admin
from django.apps import apps
from django.contrib.auth.admin import UserAdmin
from core.models import User, Daycare, SubscriptionPlan, DaycareSubscription
from superadmin.models import ManagedDaycare, ManagedUser, ManagedSubscriptionPlan, ManagedDaycareSubscription

# Extend the default UserAdmin to show custom fields
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'daycare')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'daycare')
    
    # Add daycare to the first section of the edit form
    fieldsets = UserAdmin.fieldsets + (
        ('KidSynq Settings', {'fields': ('daycare', 'branch', 'mobile', 'status')}),
    )

# Register custom UserAdmin under the fake app
admin.site.register(ManagedUser, CustomUserAdmin)

# --- Custom Admin for Daycares ---
@admin.register(ManagedDaycare)
class DaycareAdmin(admin.ModelAdmin):
    list_display = ('name', 'daycare_code', 'owner_name', 'email', 'phone', 'status', 'created_at')
    list_filter = ('status', 'organization')
    search_fields = ('name', 'daycare_code', 'owner_name', 'email', 'phone')
    ordering = ('-created_at',)

# --- Custom Admin for Subscriptions ---
@admin.register(ManagedSubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'monthly_price', 'max_staff', 'max_teachers')
    search_fields = ('name',)

@admin.register(ManagedDaycareSubscription)
class DaycareSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('daycare', 'subscription_plan', 'subscription_status', 'start_date', 'expiry_date')
    list_filter = ('subscription_status', 'subscription_plan')
    search_fields = ('daycare__name',)

# --- Generic Fallback for everything else ---
app_models = apps.get_app_config('core').get_models()
for model in app_models:
    # Skip the base models that we already registered using Proxy models
    if model in [User, Daycare, SubscriptionPlan, DaycareSubscription]:
        continue
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass
