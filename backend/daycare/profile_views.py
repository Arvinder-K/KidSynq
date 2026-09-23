from rest_framework import generics
from core.models import Daycare
from rest_framework import serializers
from core.permissions import IsDaycareAdmin

class DaycareProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Daycare
        fields = ['id', 'name', 'logo', 'contact_email', 'contact_phone', 'address', 'operating_hours', 'capacity', 'license_number', 'status']
        read_only_fields = ['id', 'status']

class DaycareProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DaycareProfileSerializer
    permission_classes = [IsDaycareAdmin]

    def get_object(self):
        return self.request.user.daycare
