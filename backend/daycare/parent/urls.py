"""
Parent and Family Domain URLs.
"""
from django.urls import path
from daycare import views

urlpatterns = [
    path('daycare/families/', views.FamilyViewSet.as_view({'get': 'list', 'post': 'create'}), name='family_list'),
    path('daycare/families/<uuid:pk>/', views.FamilyViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='family_detail'),
    path('daycare/guardians/', views.GuardianViewSet.as_view({'get': 'list', 'post': 'create'}), name='guardian_list'),
    path('daycare/guardians/<uuid:pk>/', views.GuardianViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='guardian_detail'),
    path('daycare/consent-forms/', views.ConsentFormViewSet.as_view({'get': 'list', 'post': 'create'}), name='consent_form_list'),
    path('daycare/pickup/verify/', views.PickupVerificationView.as_view(), name='pickup_verify'),
]
