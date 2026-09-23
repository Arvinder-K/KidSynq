from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import Q
from core.models import Family, Guardian, FamilyGuardian, FamilyChild, Student
from core.serializers import FamilySerializer, GuardianSerializer
from core.permissions import IsDaycareAdmin


class FamilyListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response([])
        
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()

        qs = Family.objects.filter(daycare=daycare).order_by('family_name')
        if search:
            qs = qs.filter(
                Q(family_name__icontains=search) |
                Q(primary_contact__icontains=search) |
                Q(primary_email__icontains=search) |
                Q(primary_phone__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)

        serializer = FamilySerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({'detail': 'Daycare not associated with user.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FamilySerializer(data=request.data)
        if serializer.is_valid():
            family = serializer.save(daycare=daycare)
            return Response(FamilySerializer(family).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FamilyDetailView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get_object(self, pk, daycare):
        return get_object_or_404(Family, id=pk, daycare=daycare)

    def get(self, request, pk):
        daycare = request.user.daycare
        family = self.get_object(pk, daycare)
        serializer = FamilySerializer(family)
        return Response(serializer.data)

    def patch(self, request, pk):
        daycare = request.user.daycare
        family = self.get_object(pk, daycare)
        serializer = FamilySerializer(family, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        daycare = request.user.daycare
        family = self.get_object(pk, daycare)
        family.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FamilyGuardianListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request, family_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        guardians = [fg.guardian for fg in family.family_guardians.select_related('guardian').all()]
        serializer = GuardianSerializer(guardians, many=True, context={'family': family})
        return Response(serializer.data)

    def post(self, request, family_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        data = request.data

        guardian_id = data.get('guardian_id')
        if guardian_id:
            guardian = get_object_or_404(Guardian, id=guardian_id, daycare=daycare)
        else:
            first_name = data.get('first_name', '')
            last_name = data.get('last_name', '')
            email = data.get('email', '')
            phone = data.get('phone', '')

            guardian = Guardian.objects.create(
                daycare=daycare,
                first_name=first_name,
                last_name=last_name,
                email=email,
                phone=phone
            )

        fg, _ = FamilyGuardian.objects.get_or_create(
            family=family,
            guardian=guardian,
            defaults={
                'relationship': data.get('relationship', 'Parent'),
                'is_primary': data.get('is_primary', False)
            }
        )

        serializer = GuardianSerializer(guardian, context={'family': family})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FamilyGuardianDetailView(APIView):
    permission_classes = [IsDaycareAdmin]

    def delete(self, request, family_id, guardian_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        fg = get_object_or_404(FamilyGuardian, family=family, guardian_id=guardian_id)
        fg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FamilyChildListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request, family_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        children = [fc.student for fc in family.family_children.select_related('student').all()]
        data = []
        for c in children:
            data.append({
                'id': str(c.id),
                'first_name': c.first_name,
                'last_name': c.last_name,
                'name': f"{c.first_name} {c.last_name}",
                'date_of_birth': str(c.date_of_birth) if c.date_of_birth else None,
                'status': c.status if hasattr(c, 'status') else 'Active',
            })
        return Response(data)

    def post(self, request, family_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        student_id = request.data.get('student_id')
        student = get_object_or_404(Student, id=student_id, daycare=daycare)

        fc, _ = FamilyChild.objects.get_or_create(family=family, student=student)
        return Response({
            'id': str(student.id),
            'first_name': student.first_name,
            'last_name': student.last_name,
            'name': f"{student.first_name} {student.last_name}"
        }, status=status.HTTP_201_CREATED)


class FamilyChildDetailView(APIView):
    permission_classes = [IsDaycareAdmin]

    def delete(self, request, family_id, student_id):
        daycare = request.user.daycare
        family = get_object_or_404(Family, id=family_id, daycare=daycare)
        fc = get_object_or_404(FamilyChild, family=family, student_id=student_id)
        fc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
