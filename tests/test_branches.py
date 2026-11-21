import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from core.models import Daycare, Branch, SubscriptionPlan, DaycareSubscription
from core.limits import check_subscription_limit

# Create a test setup
daycare = Daycare.objects.first()
plan = SubscriptionPlan.objects.first()
if not plan:
    plan = SubscriptionPlan.objects.create(name='Test Plan', max_branches=1)
else:
    plan.max_branches = 1
    plan.save()

sub, _ = DaycareSubscription.objects.get_or_create(daycare=daycare)
sub.subscription_plan = plan
sub.subscription_status = 'active'
sub.save()

print(f"Plan max_branches: {plan.max_branches}")

# Clear branches
Branch.objects.filter(daycare=daycare).delete()

# Test check limit
is_allowed, code, msg = check_subscription_limit(daycare, 'branches')
print(f"Limit Check 1: Allowed={is_allowed}, msg='{msg}'")

# Create branch 1
b1 = Branch.objects.create(daycare=daycare, name='Branch 1')
print("Created Branch 1")

# Test check limit again
is_allowed, code, msg = check_subscription_limit(daycare, 'branches')
print(f"Limit Check 2: Allowed={is_allowed}, msg='{msg}'")

# Restore original plan limit if needed
plan.max_branches = 0
plan.save()
