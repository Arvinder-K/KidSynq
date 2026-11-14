from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.models import DaycareSettings
from core.serializers import DaycareSettingsSerializer
from core.permissions import IsDaycareAdmin

class DaycareSettingsView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not associated with a daycare."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create settings for this daycare
        settings, created = DaycareSettings.objects.get_or_create(daycare=daycare)
        serializer = DaycareSettingsSerializer(settings)
        return Response(serializer.data)

    def patch(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not associated with a daycare."}, status=status.HTTP_400_BAD_REQUEST)
            
        settings, created = DaycareSettings.objects.get_or_create(daycare=daycare)
        serializer = DaycareSettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        # Log to file for debugging
        import json
        with open('error_log.txt', 'w') as f:
            f.write("Request Data: " + json.dumps(request.data) + "\n")
            f.write("Errors: " + json.dumps(serializer.errors) + "\n")
            
        print("Settings validation errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
