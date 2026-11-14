from django.urls import path
from .views import CommunicationDashboardView, ConsentFormsView

urlpatterns = [
    path('announcements/', CommunicationDashboardView.as_view(), name='communication_dashboard'),
    path('consents/', ConsentFormsView.as_view(), name='consent_forms_list'),
]

