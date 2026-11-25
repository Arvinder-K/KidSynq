from django.urls import path
from . import views

urlpatterns = [
    path('', views.ChildListView.as_view(), name='children_list'),
    path('new/', views.ChildCreateView.as_view(), name='children_create'),
    path('<uuid:pk>/', views.ChildDetailView.as_view(), name='children_detail'),
    path('admissions/', views.AdmissionsListView.as_view(), name='children_admissions'),
    path('waitlist/', views.WaitlistListView.as_view(), name='children_waitlist'),
]

