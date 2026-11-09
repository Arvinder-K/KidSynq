from django.urls import path
from .views import RegistrationLandingView, RegistrationWizardView

urlpatterns = [
    path('register/<slug:daycare_slug>/', RegistrationLandingView.as_view(), name='registration_landing'),
    path('register/<slug:daycare_slug>/apply/', RegistrationWizardView.as_view(), name='registration_wizard'),
]

