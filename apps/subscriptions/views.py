from django.shortcuts import render
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import Daycare, DaycareSubscription

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class DaycareSubscriptionView(StaffRequiredMixin, View):
    template_name = 'daycare/billing/daycare_subscription.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        sub = DaycareSubscription.objects.filter(daycare=daycare).select_related('subscription_plan').first()
        return render(request, self.template_name, {'subscription': sub, 'daycare': daycare})

