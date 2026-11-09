from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from django.utils import timezone

from core.models import (
    ConsentForm, ConsentFormAssignment, ConsentFormSignature,
    Student, Family, FamilyChild,
)
from core.serializers import (
    ConsentFormSerializer, ConsentFormAssignmentSerializer, ConsentFormSignatureSerializer,
)
from core.permissions import IsDaycareAdmin


class ConsentFormListView(APIView):
    """Admin: list and create consent form templates."""
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        qs = ConsentForm.objects.filter(daycare=daycare).order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = ConsentFormSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data

        form = ConsentForm.objects.create(
            daycare=daycare,
            title=data.get('title', ''),
            description=data.get('description', ''),
            content=data.get('content', ''),
            form_type=data.get('form_type', 'General'),
            requires_signature=data.get('requires_signature', True),
            status='Active',
            created_by=request.user,
        )

        serializer = ConsentFormSerializer(form)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConsentFormDetailView(APIView):
    """Admin: retrieve, update, archive a consent form template."""
    permission_classes = [IsDaycareAdmin]

    def _get_form(self, pk, daycare):
        try:
            return ConsentForm.objects.get(id=pk, daycare=daycare)
        except ConsentForm.DoesNotExist:
            return None

    def get(self, request, pk):
        form = self._get_form(pk, request.user.daycare)
        if not form:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ConsentFormSerializer(form)
        return Response(serializer.data)

    def put(self, request, pk):
        form = self._get_form(pk, request.user.daycare)
        if not form:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        form.title = data.get('title', form.title)
        form.description = data.get('description', form.description)
        form.content = data.get('content', form.content)
        form.form_type = data.get('form_type', form.form_type)
        form.requires_signature = data.get('requires_signature', form.requires_signature)
        form.save()

        serializer = ConsentFormSerializer(form)
        return Response(serializer.data)

    def delete(self, request, pk):
        form = self._get_form(pk, request.user.daycare)
        if not form:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)
        form.status = 'Archived'
        form.save()
        return Response({'detail': 'Consent form archived.'})


class ConsentFormAssignView(APIView):
    """Admin: assign a consent form to one or more students."""
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        daycare = request.user.daycare

        try:
            form = ConsentForm.objects.get(id=pk, daycare=daycare)
        except ConsentForm.DoesNotExist:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)

        student_ids = request.data.get('student_ids', [])
        due_date = request.data.get('due_date')

        if not student_ids:
            return Response({'detail': 'At least one student_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        skipped = []

        for student_id in student_ids:
            student = Student.objects.filter(id=student_id, daycare=daycare, deleted_at__isnull=True).first()
            if not student:
                skipped.append({'student_id': student_id, 'reason': 'Not found'})
                continue

            # Look up family for this student
            fc = FamilyChild.objects.filter(student=student).first()
            family = fc.family if fc else None

            assignment, was_created = ConsentFormAssignment.objects.get_or_create(
                consent_form=form,
                student=student,
                defaults={
                    'family': family,
                    'status': 'Pending',
                    'due_date': due_date,
                    'assigned_by': request.user,
                }
            )

            if was_created:
                created.append(str(student.id))
            else:
                skipped.append({'student_id': str(student_id), 'reason': 'Already assigned'})

        return Response({
            'detail': f'{len(created)} assignment(s) created.',
            'created': created,
            'skipped': skipped,
        }, status=status.HTTP_201_CREATED)


class ConsentFormSignaturesView(APIView):
    """Admin: view all signatures for a consent form."""
    permission_classes = [IsDaycareAdmin]

    def get(self, request, pk):
        daycare = request.user.daycare

        try:
            form = ConsentForm.objects.get(id=pk, daycare=daycare)
        except ConsentForm.DoesNotExist:
            return Response({'detail': 'Consent form not found.'}, status=status.HTTP_404_NOT_FOUND)

        assignments = ConsentFormAssignment.objects.filter(
            consent_form=form
        ).select_related('student', 'signature')

        data = []
        for assignment in assignments:
            sig = getattr(assignment, 'signature', None)
            data.append({
                'assignment_id': str(assignment.id),
                'student_name': f"{assignment.student.first_name} {assignment.student.last_name}",
                'status': assignment.status,
                'due_date': assignment.due_date,
                'signature': ConsentFormSignatureSerializer(sig).data if sig else None,
            })

        return Response({
            'form_title': form.title,
            'total': len(data),
            'signed': sum(1 for d in data if d['status'] == 'Signed'),
            'pending': sum(1 for d in data if d['status'] == 'Pending'),
            'assignments': data,
        })
