from django.urls import path
from . import views

urlpatterns = [
    path('plan/', views.DaycareSubscriptionView.as_view(), name='subscriptions_plan'),
]

