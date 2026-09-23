from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import generics, status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q, Sum, F, ExpressionWrapper, fields
from django.utils import timezone
from datetime import datetime, timedelta
import uuid

from core.models import *
from core.serializers import *
from core.permissions import IsDaycareAdmin
from rest_framework import serializers


class DocumentFolderView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        folders = DocumentFolder.objects.filter(daycare=daycare)
        serializer = DocumentFolderSerializer(folders, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        folder = DocumentFolder.objects.create(
            daycare=daycare,
            name=request.data.get('name'),
            description=request.data.get('description')
        )
        serializer = DocumentFolderSerializer(folder)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DocumentListView(APIView):
    permission_classes = [IsDaycareAdmin]
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request):
        daycare = request.user.daycare
        folder_id = request.query_params.get('folder_id')
        
        documents = Document.objects.filter(daycare=daycare, deleted_at__isnull=True)
        if folder_id:
            documents = documents.filter(folder_id=folder_id)
            
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        if 'file' not in request.FILES:
            return Response({"detail": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
            
        uploaded_file = request.FILES['file']
        fs = FileSystemStorage()
        filename = fs.save(uploaded_file.name, uploaded_file)
        
        folder_id = request.data.get('folder_id')
        if folder_id == 'null' or folder_id == '':
            folder_id = None
            
        document = Document.objects.create(
            daycare=daycare,
            title=request.data.get('title', uploaded_file.name),
            description=request.data.get('description', ''),
            folder_id=folder_id,
            file_path=fs.url(filename),
            file_type=uploaded_file.content_type,
            file_size=uploaded_file.size,
            uploaded_by=request.user,
            status='Active',
            visibility='Internal'
        )
        
        serializer = DocumentSerializer(document)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

from core.models import IncidentReport, InspectionVisit
from core.serializers import IncidentReportSerializer, InspectionVisitSerializer
import datetime


