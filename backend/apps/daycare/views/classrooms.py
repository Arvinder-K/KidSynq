from rest_framework.decorators import action
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


class ClassroomListView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        serializer = ClassroomSerializer(classrooms, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            classroom = Classroom.objects.create(
                daycare=daycare,
                program_id=data.get('program_id') or None,
                room_name=data.get('room_name', ''),
                capacity=data.get('capacity', 0),
                min_age_months=data.get('min_age_months', 0),
                max_age_months=data.get('max_age_months', 0),
                primary_teacher_id=data.get('primary_teacher_id') or None,
                status=data.get('status', 'Active'),
                color=data.get('color', '#10B981')
            )
            serializer = ClassroomSerializer(classroom)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ClassroomAssignTeacherView(APIView):
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            teacher_id = request.data.get('teacher_id')
            raw_role = request.data.get('role', 'primary') # 'primary' or 'assistant'
            assignment_type = 'Primary' if raw_role.lower() == 'primary' else 'Assistant'
            
            if not teacher_id:
                return Response({"detail": "Teacher ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from core.models import Employee
            from core.services.teacher_assignment_service import TeacherAssignmentService
            teacher = Employee.objects.get(pk=teacher_id, daycare=daycare)
            
            assignment = TeacherAssignmentService.assign_teacher(
                classroom=classroom,
                employee=teacher,
                assignment_type=assignment_type,
                assigned_by=request.user
            )
            
            return Response({
                "detail": f"Teacher assigned as {assignment_type} successfully.",
                "assignment_id": str(assignment.id)
            })
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)



class ClassroomAssignStudentView(APIView):
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            student_id = request.data.get('student_id')
            
            if not student_id:
                return Response({"detail": "Student ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from core.models import Student, ClassroomStudent
            student = Student.objects.get(pk=student_id, daycare=daycare, deleted_at__isnull=True)
            
            # Check if already assigned to this classroom
            existing = ClassroomStudent.objects.filter(classroom=classroom, student=student, status='Active').first()
            if existing:
                return Response({"detail": "Student is already assigned to this classroom."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Check capacity
            current_assigned = ClassroomStudent.objects.filter(classroom=classroom, status='Active').count()
            if current_assigned >= (classroom.capacity or 0):
                return Response({"detail": "Classroom is at full capacity."}, status=status.HTTP_400_BAD_REQUEST)
                
            from django.utils import timezone
            ClassroomStudent.objects.create(
                classroom=classroom,
                student=student,
                status='Active',
                start_date=timezone.now().date()
            )
            
            return Response({"detail": "Student assigned successfully."})
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from core.models import StudentAttendance
from core.serializers import AttendanceRosterSerializer
from django.utils import timezone


class ClassroomTeacherViewSet(viewsets.ModelViewSet):
    permission_classes = [IsDaycareAdmin]
    serializer_class = ClassroomTeacherAssignmentSerializer

    def get_queryset(self):
        daycare = self.request.user.daycare
        queryset = ClassroomTeacherAssignment.objects.filter(
            daycare=daycare, 
            deleted_at__isnull=True,
            status='Active'
        )
        classroom_id = self.request.query_params.get('classroom_id')
        if classroom_id:
            queryset = queryset.filter(classroom_id=classroom_id)
        return queryset

    def perform_create(self, serializer):
        try:
            employee = serializer.validated_data.get('employee')
            classroom = serializer.validated_data.get('classroom')
            assignment_type = serializer.validated_data.get('assignment_type')
            
            assignment = TeacherAssignmentService.assign_teacher(
                classroom=classroom,
                employee=employee,
                assignment_type=assignment_type,
                assigned_by=self.request.user
            )
            serializer.instance = assignment
        except ValueError as e:
            raise serializers.ValidationError({"detail": str(e)})

    def perform_destroy(self, instance):
        success = TeacherAssignmentService.remove_teacher(instance.id, self.request.user)
        if not success:
            raise serializers.ValidationError({"detail": "Assignment could not be removed."})


class AvailableTeachersView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response([], status=status.HTTP_200_OK)

        employees = Employee.objects.filter(
            daycare=daycare,
            status='active'
        ).prefetch_related('types')
        
        search = request.query_params.get('search')
        if search:
            employees = employees.filter(
                Q(first_name__icontains=search) | 
                Q(last_name__icontains=search) | 
                Q(employee_number__icontains=search) |
                Q(types__name__icontains=search)
            )

        # Filter only teaching eligible employees
        eligible_teachers = [e for e in employees if e.is_eligible_for_classroom()]
            
        serializer = AvailableTeacherSerializer(eligible_teachers, many=True)
        # Add workload to each teacher
        data = serializer.data
        for item in data:
            emp = next((e for e in eligible_teachers if str(e.id) == str(item['id'])), None)
            if emp:
                item['workload'] = TeacherAssignmentService.get_teacher_workload(emp)
        return Response(data)



class ClassroomTeachersView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request, pk):
        daycare = request.user.daycare
        assignments = ClassroomTeacherAssignment.objects.filter(
            classroom_id=pk,
            daycare=daycare,
            status='Active',
            deleted_at__isnull=True
        )
        serializer = ClassroomTeacherAssignmentSerializer(assignments, many=True)
        return Response(serializer.data)


from core.models import SystemAnnouncement
from core.serializers import SystemAnnouncementSerializer
from django.db.models import Q



from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from core.models import Classroom
from core.serializers import ClassroomSerializer
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsDaycareAdmin

class ClassroomViewSet(viewsets.ModelViewSet):
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['room_name', 'room_code', 'description']
    filterset_fields = ['status', 'age_group', 'branch']

    def get_queryset(self):
        user = self.request.user
        if not user.daycare:
            return Classroom.objects.none()
        return Classroom.objects.filter(daycare=user.daycare, deleted_at__isnull=True).order_by('room_name')

    def perform_create(self, serializer):
        from core.limits import check_subscription_limit
        daycare = self.request.user.daycare
        if not daycare:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "User is not associated with any daycare."})
        is_allowed, error_code, error_msg = check_subscription_limit(daycare, 'classrooms', increment=1)
        if not is_allowed:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": error_msg, "code": error_code})
        serializer.save(daycare=daycare)

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        from django.utils import timezone
        instance.deleted_at = timezone.now()
        instance.status = 'inactive'
        instance.save()


class ClassroomScheduleView(APIView):
    """
    Returns weekly or dated classroom schedule along with educators, shifts, breaks, and coverage metrics.
    """
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request, pk):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "Daycare not found."}, status=status.HTTP_400_BAD_REQUEST)

        classroom = get_object_or_404(Classroom, pk=pk, daycare=daycare, deleted_at__isnull=True)

        params = request.query_params
        start_date_str = params.get('start_date')
        end_date_str = params.get('end_date')
        single_date_str = params.get('date')

        from datetime import datetime, date
        target_date = None
        if single_date_str:
            try:
                target_date = datetime.strptime(single_date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = date.today()
        elif start_date_str:
            try:
                target_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = date.today()
        else:
            target_date = date.today()

        from core.models import StaffSchedule, ClassroomTeacherAssignment
        shifts_qs = StaffSchedule.objects.filter(
            daycare=daycare,
            classroom=classroom
        ).exclude(status='cancelled').select_related(
            'employee', 'branch'
        ).prefetch_related('breaks')

        if start_date_str and end_date_str:
            shifts_qs = shifts_qs.filter(date__gte=start_date_str, date__lte=end_date_str)
        elif single_date_str:
            shifts_qs = shifts_qs.filter(date=single_date_str)

        from core.serializers import StaffScheduleSerializer
        from daycare.services.scheduling import SchedulingService

        shifts_data = StaffScheduleSerializer(shifts_qs.order_by('date', 'shift_start'), many=True).data
        coverage_data = SchedulingService.calculate_classroom_coverage(daycare, classroom, target_date)

        # Get assigned teachers
        primary_assignment = ClassroomTeacherAssignment.objects.filter(
            classroom=classroom, assignment_type='Primary', status='Active', deleted_at__isnull=True
        ).select_related('employee').first()
        assistant_assignments = ClassroomTeacherAssignment.objects.filter(
            classroom=classroom, assignment_type='Assistant', status='Active', deleted_at__isnull=True
        ).select_related('employee')

        return Response({
            "classroom": {
                "id": str(classroom.id),
                "room_name": classroom.room_name,
                "room_code": classroom.room_code,
                "capacity": classroom.capacity,
                "status": classroom.status,
                "age_group": classroom.age_group.name if classroom.age_group else None,
                "primary_teacher": f"{primary_assignment.employee.first_name} {primary_assignment.employee.last_name}" if primary_assignment else None,
                "assistants": [f"{a.employee.first_name} {a.employee.last_name}" for a in assistant_assignments]
            },
            "shifts": shifts_data,
            "coverage": coverage_data
        })


class ClassroomCoverageView(APIView):
    """
    Dedicated endpoint for hourly classroom coverage and ratio compliance calculation.
    """
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get(self, request, pk):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "Daycare not found."}, status=status.HTTP_400_BAD_REQUEST)

        classroom = get_object_or_404(Classroom, pk=pk, daycare=daycare, deleted_at__isnull=True)

        date_str = request.query_params.get('date')
        from datetime import datetime, date
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_date = date.today()

        from daycare.services.scheduling import SchedulingService
        coverage = SchedulingService.calculate_classroom_coverage(daycare, classroom, target_date)
        return Response(coverage)

