from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Daycare, SubscriptionPlan, DaycareSubscription
from .serializers import AdminDaycareSerializer, AdminUserSerializer, SubscriptionPlanSerializer, DaycareSubscriptionSerializer
from .permissions import IsSuperUser

User = get_user_model()

class AdminDaycareListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all().order_by('-created_at')
    serializer_class = AdminDaycareSerializer

class AdminDaycareDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all()
    serializer_class = AdminDaycareSerializer

from django.db.models import Q

class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).order_by('-date_joined')
    
class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer

class AdminSubscriptionPlanListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all().order_by('price')
    serializer_class = SubscriptionPlanSerializer

class AdminSubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer

class AdminDaycareSubscriptionListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all().order_by('-created_at')
    serializer_class = DaycareSubscriptionSerializer
