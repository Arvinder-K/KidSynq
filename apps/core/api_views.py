from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import User, Student
from .serializers import UserSerializer

class UserDetailView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

from rest_framework.views import APIView
from rest_framework.response import Response

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = {
            'students_present': 0,
            'activities_logged': 0,
            'meals_recorded': 0,
            'incidents_reported': 0,
        }
        return Response(stats)

from django.db.models import Count, Sum, Q

class ClassroomDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
        
        from .models import Classroom, ClassroomStudent
        
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True)
        total_classrooms = classrooms.count()
        active_classrooms = classrooms.filter(status='Active').count()
        
        students_assigned = ClassroomStudent.objects.filter(
            classroom__daycare=daycare, 
            status='Active'
        ).count()
        
        primary_teachers = classrooms.exclude(primary_teacher__isnull=True).values_list('primary_teacher_id', flat=True)
        assistant_teachers = classrooms.exclude(assistant_teacher__isnull=True).values_list('assistant_teacher_id', flat=True)
        teachers_assigned = len(set(list(primary_teachers) + list(assistant_teachers)))
        
        total_capacity = classrooms.aggregate(total=Sum('capacity'))['total'] or 0
        available_seats = max(0, total_capacity - students_assigned)
        
        occupancy_percentage = int((students_assigned / total_capacity * 100)) if total_capacity > 0 else 0
        
        occupancy_chart = []
        student_distribution = []
        
        for c in classrooms.prefetch_related('enrollments'):
            assigned = c.enrollments.filter(status='Active').count()
            capacity = c.capacity or 0
            avail = max(0, capacity - assigned)
            occupancy_chart.append({
                "name": c.room_name,
                "occupied": assigned,
                "available": avail
            })
            if assigned > 0:
                student_distribution.append({
                    "name": c.room_name,
                    "students": assigned
                })
                
        recent_classrooms = classrooms.order_by('-created_at')[:10]
        recent_list = []
        for c in recent_classrooms:
            assigned = c.enrollments.filter(status='Active').count()
            recent_list.append({
                "id": str(c.id),
                "name": c.room_name,
                "age_group": f"{c.min_age_months or 0}-{c.max_age_months or 0}m",
                "capacity": c.capacity,
                "status": c.status,
                "created_at": c.created_at,
                "assigned": assigned
            })
            
        return Response({
            "total_classrooms": total_classrooms,
            "active_classrooms": active_classrooms,
            "students_assigned": students_assigned,
            "teachers_assigned": teachers_assigned,
            "available_seats": available_seats,
            "occupancy_percentage": occupancy_percentage,
            "occupancy_chart": occupancy_chart,
            "student_distribution": student_distribution,
            "recent_classrooms": recent_list
        })

from .models import Employee
from .serializers import EmployeeSerializer
from rest_framework import status
from django.db import transaction

class StaffListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
        
        employees = Employee.objects.filter(daycare=daycare)
        serializer = EmployeeSerializer(employees, many=True)
        return Response(serializer.data)
        
    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
            
        data = request.data
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=data.get('email'),
                    email=data.get('email'),
                    password='password123', # Default password
                    first_name=data.get('first_name'),
                    last_name=data.get('last_name'),
                    daycare=daycare
                )
                
                employee = Employee.objects.create(
                    user=user,
                    daycare=daycare,
                    role=data.get('role', 'Teacher'),
                    employee_number=data.get('employee_number', ''),
                    employment_type=data.get('employment_type', 'Full-time')
                )
                
            serializer = EmployeeSerializer(employee)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import Student, ChildEnrollment
from .serializers import StudentSerializer

class StudentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
        
        students = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('first_name')
        serializer = StudentSerializer(students, many=True)
        return Response(serializer.data)
        
    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "User is not assigned to a daycare."}, status=status.HTTP_400_BAD_REQUEST)
            
        data = request.data
        try:
            student = Student.objects.create(
                daycare=daycare,
                admission_number=data.get('admission_number'),
                admission_date=data.get('admission_date') or None,
                first_name=data.get('first_name'),
                last_name=data.get('last_name'),
                dob=data.get('dob') or None,
                gender=data.get('gender'),
                status=data.get('status', 'Active'),
                allergies=data.get('allergies'),
                medical_conditions=data.get('medical_conditions'),
                medication=data.get('medication'),
                doctor_name=data.get('doctor_name'),
                doctor_phone=data.get('doctor_phone'),
                hospital_name=data.get('hospital_name'),
            )
            serializer = StudentSerializer(student)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import Document, DocumentFolder
from .serializers import DocumentFolderSerializer, DocumentSerializer
from django.core.files.storage import FileSystemStorage
from rest_framework.parsers import MultiPartParser, FormParser

class DocumentFolderView(APIView):
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]
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

from .models import IncidentReport, InspectionVisit
from .serializers import IncidentReportSerializer, InspectionVisitSerializer
import datetime

class IncidentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        incidents = IncidentReport.objects.filter(daycare=daycare).order_by('-incident_date')
        serializer = IncidentReportSerializer(incidents, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            incident = IncidentReport.objects.create(
                daycare=daycare,
                student_id=data.get('student_id'),
                reporter_id=request.user.employee.id if hasattr(request.user, 'employee') else None,
                incident_date=data.get('incident_date') or datetime.date.today(),
                incident_time=data.get('incident_time') or datetime.datetime.now().time(),
                location=data.get('location', ''),
                description=data.get('description', ''),
                action_taken=data.get('action_taken', ''),
                status='Open'
            )
            serializer = IncidentReportSerializer(incident)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class InspectionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        inspections = InspectionVisit.objects.filter(daycare=daycare).order_by('-visit_date')
        serializer = InspectionVisitSerializer(inspections, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            inspection = InspectionVisit.objects.create(
                daycare=daycare,
                inspector_name=data.get('inspector_name', ''),
                agency=data.get('agency', ''),
                visit_date=data.get('visit_date') or datetime.date.today(),
                visit_type=data.get('visit_type', 'Routine'),
                status='Completed',
                overall_result=data.get('overall_result', 'Compliant'),
                notes=data.get('notes', '')
            )
            serializer = InspectionVisitSerializer(inspection)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import Program, Classroom
from .serializers import ProgramSerializer, ClassroomSerializer

class ProgramListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        programs = Program.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('sort_order', 'name')
        serializer = ProgramSerializer(programs, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        try:
            program = Program.objects.create(
                daycare=daycare,
                name=data.get('name', ''),
                description=data.get('description', ''),
                age_group=data.get('age_group', ''),
                min_age_months=data.get('min_age_months', 0),
                max_age_months=data.get('max_age_months', 0),
                program_fee=data.get('program_fee', 0.0),
                color=data.get('color', '#3B82F6'),
                status=data.get('status', 'Active')
            )
            serializer = ProgramSerializer(program)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ClassroomListView(APIView):
    permission_classes = [IsAuthenticated]

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

from django.utils import timezone
from .models import ClassroomTeacherAssignment
from .serializers import ClassroomTeacherAssignmentSerializer

class ClassroomStaffListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            assignments = ClassroomTeacherAssignment.objects.filter(classroom=classroom, deleted_at__isnull=True).order_by('-assigned_date', '-created_at')
            serializer = ClassroomTeacherAssignmentSerializer(assignments, many=True)
            return Response(serializer.data)
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)


class ClassroomPrimaryTeacherView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            employee_id = request.data.get('employee_id')
            
            if not employee_id:
                return Response({"detail": "Employee ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from .models import Employee
            employee = Employee.objects.get(pk=employee_id, daycare=daycare)
            
            if employee.status in ['suspended', 'inactive']:
                return Response({"detail": "Employee is not eligible for assignment."}, status=status.HTTP_400_BAD_REQUEST)
                
            with transaction.atomic():
                # End current active primary teacher if exists
                active_primary_assignments = ClassroomTeacherAssignment.objects.filter(
                    classroom=classroom,
                    assignment_type='Primary',
                    status='Active',
                    deleted_at__isnull=True
                )
                
                for assignment in active_primary_assignments:
                    assignment.status = 'Ended'
                    assignment.end_date = timezone.now().date()
                    assignment.save()
                    
                # Create new assignment
                new_assignment = ClassroomTeacherAssignment.objects.create(
                    daycare=daycare,
                    classroom=classroom,
                    employee=employee,
                    assignment_type='Primary',
                    status='Active',
                    created_by=request.user
                )
                
                # Update classroom primary teacher field
                classroom.primary_teacher = employee.user
                classroom.save()
            
            serializer = ClassroomTeacherAssignmentSerializer(new_assignment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found or belongs to another daycare."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ClassroomAssistantTeacherView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            employee_id = request.data.get('employee_id')
            
            if not employee_id:
                return Response({"detail": "Employee ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from .models import Employee
            employee = Employee.objects.get(pk=employee_id, daycare=daycare)
            
            if employee.status in ['suspended', 'inactive']:
                return Response({"detail": "Employee is not eligible for assignment."}, status=status.HTTP_400_BAD_REQUEST)
                
            with transaction.atomic():
                # Create new assignment
                new_assignment = ClassroomTeacherAssignment.objects.create(
                    daycare=daycare,
                    classroom=classroom,
                    employee=employee,
                    assignment_type='Assistant',
                    status='Active',
                    created_by=request.user
                )
                
                # Update classroom staff many-to-many
                if employee.user:
                    classroom.staff.add(employee.user)
            
            serializer = ClassroomTeacherAssignmentSerializer(new_assignment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found or belongs to another daycare."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ClassroomStaffDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        daycare = request.user.daycare
        try:
            assignment = ClassroomTeacherAssignment.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            
            if 'status' in request.data:
                assignment.status = request.data.get('status')
            if 'end_date' in request.data:
                assignment.end_date = request.data.get('end_date')
                
            assignment.updated_by = request.user
            assignment.save()
            
            serializer = ClassroomTeacherAssignmentSerializer(assignment)
            return Response(serializer.data)
            
        except ClassroomTeacherAssignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        daycare = request.user.daycare
        try:
            assignment = ClassroomTeacherAssignment.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            
            with transaction.atomic():
                assignment.status = 'Ended'
                assignment.end_date = timezone.now().date()
                assignment.updated_by = request.user
                assignment.save()
                
                classroom = assignment.classroom
                if assignment.assignment_type == 'Primary':
                    # If this was the current primary teacher, clear it
                    if classroom.primary_teacher == assignment.employee.user:
                        classroom.primary_teacher = None
                        classroom.save()
                else:
                    if assignment.employee.user:
                        classroom.staff.remove(assignment.employee.user)
            
            return Response({"detail": "Staff removed from classroom successfully."}, status=status.HTTP_200_OK)
            
        except ClassroomTeacherAssignment.DoesNotExist:
            return Response({"detail": "Assignment not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ClassroomAssignStudentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            student_id = request.data.get('student_id')
            
            if not student_id:
                return Response({"detail": "Student ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from .models import Student, ClassroomStudent
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

from .models import StudentAttendance
from .serializers import AttendanceRosterSerializer
from django.utils import timezone

class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        date_str = request.query_params.get('date')
        if date_str:
            current_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            current_date = timezone.now().date()
            
        students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).order_by('first_name')
        attendances = StudentAttendance.objects.filter(daycare=daycare, attendance_date=current_date)
        attendance_dict = {att.student_id: att for att in attendances}
        
        for student in students:
            student.today_attendance = attendance_dict.get(student.id)
            
        serializer = AttendanceRosterSerializer(students, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        student_id = data.get('student_id')
        date_str = data.get('date', timezone.now().date().isoformat())
        status_val = data.get('status')
        
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare)
            
            attendance, created = StudentAttendance.objects.update_or_create(
                student=student,
                attendance_date=date_str,
                defaults={
                    'daycare': daycare,
                    'attendance_status': status_val,
                    'updated_by': request.user,
                }
            )
            
            if created:
                attendance.created_by = request.user
                
            if status_val == 'Present' and not attendance.check_in_time:
                attendance.check_in_time = timezone.now().time()
            elif status_val == 'Absent':
                attendance.check_in_time = None
                attendance.check_out_time = None
                
            attendance.save()
            return Response({"status": "success"})
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import DailyReport, MealRecord, NapRecord, ActivityRecord
from .serializers import DailyReportSerializer, MealRecordSerializer, NapRecordSerializer, ActivityRecordSerializer

class DailyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        student_id = request.query_params.get('student_id')
        date_str = request.query_params.get('date')
        
        if not student_id:
            return Response({"detail": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        if date_str:
            current_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            current_date = timezone.now().date()
            
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare)
            report, _ = DailyReport.objects.get_or_create(
                student=student,
                report_date=current_date,
                defaults={
                    'daycare': daycare,
                    'teacher': request.user if not hasattr(request.user, 'employee_profile') else None # Will fix teacher assignment in real app
                }
            )
            serializer = DailyReportSerializer(report)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ActivityLogView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        report_id = data.get('report_id')
        activity_type = data.get('type') # 'meal', 'nap', 'activity'
        
        try:
            report = DailyReport.objects.get(pk=report_id, daycare=daycare)
            
            if activity_type == 'meal':
                meal = MealRecord.objects.create(
                    daily_report=report,
                    meal_type=data.get('meal_type', ''),
                    food_provided=data.get('food_provided', ''),
                    amount_eaten=data.get('amount_eaten', '')
                )
                return Response(MealRecordSerializer(meal).data, status=status.HTTP_201_CREATED)
                
            elif activity_type == 'nap':
                nap = NapRecord.objects.create(
                    daily_report=report,
                    start_time=data.get('start_time'),
                    end_time=data.get('end_time') or None,
                    quality=data.get('quality', '')
                )
                return Response(NapRecordSerializer(nap).data, status=status.HTTP_201_CREATED)
                
            elif activity_type == 'activity':
                act = ActivityRecord.objects.create(
                    daily_report=report,
                    activity_type=data.get('activity_type', ''),
                    description=data.get('description', '')
                )
                return Response(ActivityRecordSerializer(act).data, status=status.HTTP_201_CREATED)
                
            else:
                return Response({"detail": "Invalid activity type"}, status=status.HTTP_400_BAD_REQUEST)
                
        except DailyReport.DoesNotExist:
            return Response({"detail": "Report not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import HealthProfile, Allergy, Medication, MedicationAdministration
from .serializers import StudentHealthDashboardSerializer, StudentHealthDetailSerializer, MedicationAdministrationSerializer

class HealthDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        students = Student.objects.filter(daycare=daycare, status='Active', deleted_at__isnull=True).prefetch_related('allergy_records', 'medication_records')
        serializer = StudentHealthDashboardSerializer(students, many=True)
        return Response(serializer.data)

class StudentHealthDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        daycare = request.user.daycare
        try:
            student = Student.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            # Ensure health profile exists
            HealthProfile.objects.get_or_create(
                student=student, 
                defaults={'daycare': daycare}
            )
            serializer = StudentHealthDetailSerializer(student)
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

class MedicationAdministrationView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        medication_id = data.get('medication_id')
        
        try:
            medication = Medication.objects.get(pk=medication_id, student__daycare=daycare)
            
            admin = MedicationAdministration.objects.create(
                medication=medication,
                administered_by=request.user,
                date=timezone.now().date(),
                time=timezone.now().time(),
                dosage_given=data.get('dosage_given', ''),
                outcome=data.get('outcome', ''),
                teacher_notes=data.get('teacher_notes', '')
            )
            
            serializer = MedicationAdministrationSerializer(admin)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Medication.DoesNotExist:
            return Response({"detail": "Medication not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import Invoice, InvoiceItem, Payment, SubscriptionPlan, DaycareSubscription
from .serializers import InvoiceSerializer, SubscriptionPlanSerializer, DaycareSubscriptionSerializer
import uuid
from datetime import timedelta

class InvoiceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        invoices = Invoice.objects.filter(daycare=daycare).order_by('-issue_date')
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        student_id = data.get('student_id')
        
        try:
            student = Student.objects.get(pk=student_id, daycare=daycare)
            invoice = Invoice.objects.create(
                daycare=daycare,
                student=student,
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                issue_date=data.get('issue_date', timezone.now().date()),
                due_date=data.get('due_date', timezone.now().date() + timedelta(days=14)),
                subtotal=0,
                total_amount=0,
                status='Unpaid'
            )
            
            amount = float(data.get('amount', 0))
            if amount > 0:
                InvoiceItem.objects.create(
                    invoice=invoice,
                    student=student,
                    description=data.get('description', 'Tuition Fee'),
                    quantity=1,
                    unit_price=amount,
                    total=amount
                )
                invoice.subtotal = amount
                invoice.total_amount = amount
                invoice.save()
                
            serializer = InvoiceSerializer(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class InvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        daycare = request.user.daycare
        try:
            invoice = Invoice.objects.get(pk=pk, daycare=daycare)
            serializer = InvoiceSerializer(invoice)
            return Response(serializer.data)
        except Invoice.DoesNotExist:
            return Response({"detail": "Invoice not found"}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request, pk):
        # Record a payment
        daycare = request.user.daycare
        data = request.data
        try:
            invoice = Invoice.objects.get(pk=pk, daycare=daycare)
            amount = float(data.get('amount', 0))
            
            Payment.objects.create(
                daycare=daycare,
                invoice=invoice,
                student=invoice.student,
                amount=amount,
                payment_date=timezone.now().date(),
                payment_method=data.get('payment_method', 'Credit Card')
            )
            
            invoice.amount_paid += amount
            if invoice.amount_paid >= invoice.total_amount:
                invoice.status = 'Paid'
            elif invoice.amount_paid > 0:
                invoice.status = 'Partially Paid'
            invoice.save()
            
            serializer = InvoiceSerializer(invoice)
            return Response(serializer.data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SubscriptionPlanListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by('monthly_price')
        plan_serializer = SubscriptionPlanSerializer(plans, many=True)
        
        current_sub = None
        if request.user.daycare:
            current_sub = request.user.daycare.subscriptions.filter(subscription_status='Active').first()
            
        return Response({
            'plans': plan_serializer.data,
            'current_subscription': DaycareSubscriptionSerializer(current_sub).data if current_sub else None
        })

class SubscriptionCheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        daycare = request.user.daycare
        if not daycare:
            return Response({"detail": "No daycare found"}, status=status.HTTP_400_BAD_REQUEST)
            
        plan_id = request.data.get('plan_id')
        try:
            plan = SubscriptionPlan.objects.get(pk=plan_id)
            
            start_date = timezone.now().date()
            expiry_date = start_date + timedelta(days=30)
            
            # Deactivate old
            daycare.subscriptions.filter(subscription_status='Active').update(subscription_status='Canceled')
            
            sub = DaycareSubscription.objects.create(
                daycare=daycare,
                subscription_plan=plan,
                start_date=start_date,
                expiry_date=expiry_date,
                renewal_date=expiry_date,
                subscription_status='Active'
            )
            
            return Response(DaycareSubscriptionSerializer(sub).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

from .models import Announcement
from .serializers import AnnouncementSerializer, UserProfileSerializer
from django.contrib.auth import update_session_auth_hash

class AnnouncementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        announcements = Announcement.objects.filter(daycare=daycare).order_by('-published_at')
        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        
        try:
            announcement = Announcement.objects.create(
                daycare=daycare,
                sender=request.user,
                title=data.get('title'),
                content=data.get('content'),
                type=data.get('type', 'General'),
                status='Published',
                published_at=timezone.now()
            )
            serializer = AnnouncementSerializer(announcement)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)
        
    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserPasswordView(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not user.check_password(old_password):
            return Response({"detail": "Incorrect old password"}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save()
        # Keep user logged in after password change
        update_session_auth_hash(request, user)
        return Response({"detail": "Password updated successfully"})

from rest_framework.decorators import action
from django.utils import timezone
from .models import AgeGroup
from .serializers import AgeGroupSerializer
from rest_framework import viewsets

class AgeGroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AgeGroupSerializer

    def get_queryset(self):
        daycare = self.request.user.daycare
        queryset = AgeGroup.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('display_order', 'min_age_months')
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter and status_filter != 'All':
            queryset = queryset.filter(status=status_filter)
            
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(
            daycare=self.request.user.daycare,
            created_by=self.request.user,
            updated_by=self.request.user
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.status = 'Archived'
        instance.save()

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Archived'
        instance.save()
        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'Active'
        instance.deleted_at = None
        instance.save()
        return Response({'status': 'restored'})

from .services.teacher_assignment_service import TeacherAssignmentService
from .serializers import ClassroomTeacherAssignmentSerializer, AvailableTeacherSerializer
from .models import ClassroomTeacherAssignment, Employee

class ClassroomTeacherViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        daycare = request.user.daycare
        teachers = Employee.objects.filter(
            daycare=daycare,
            role='Teacher'
        ).exclude(user__status='Inactive')
        
        search = request.query_params.get('search')
        if search:
            teachers = teachers.filter(
                Q(first_name__icontains=search) | 
                Q(last_name__icontains=search) | 
                Q(employee_number__icontains=search)
            )
            
        serializer = AvailableTeacherSerializer(teachers, many=True)
        # Add workload to each teacher
        data = serializer.data
        for item in data:
            employee = teachers.get(id=item['id'])
            item['workload'] = TeacherAssignmentService.get_teacher_workload(employee)
        return Response(data)

class ClassroomTeachersView(APIView):
    permission_classes = [IsAuthenticated]

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

from .serializers import ChildListSerializer, ChildDetailSerializer
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from .models import StudentEmergencyContact, AuditLog, Branch, ChildEnrollment, Classroom, ClassroomStudent, StudentPickup

class ChildViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        daycare = self.request.user.daycare
        queryset = Student.objects.filter(daycare=daycare, deleted_at__isnull=True)
        
        # Filtering
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(admission_number__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(preferred_name__icontains=search)
            )
            
        return queryset.order_by('-created_at')
        
    def get_serializer_class(self):
        if self.action == 'list':
            return ChildListSerializer
        return ChildDetailSerializer

    def create(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        daycare = request.user.daycare
        admission_number = request.data.get('admission_number')
        
        if not admission_number:
            return Response({"detail": "Admission number is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Uniqueness check
        if Student.objects.filter(daycare=daycare, admission_number=admission_number).exists():
            return Response({"detail": "Admission number must be unique within the daycare."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create Student
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            student = serializer.save(daycare=daycare)

            # Create ChildEnrollment
            ChildEnrollment.objects.create(
                student=student,
                application_date=student.admission_date,
                enrollment_date=student.admission_date,
                start_date=student.joining_date,
                status='Active'
            )

            # Create Emergency Contact if provided
            emergency_contact = request.data.get('emergency_contact')
            if emergency_contact and emergency_contact.get('name'):
                StudentEmergencyContact.objects.create(
                    student=student,
                    name=emergency_contact.get('name'),
                    relationship=emergency_contact.get('relationship'),
                    mobile=emergency_contact.get('mobile'),
                    email=emergency_contact.get('email', ''),
                    is_primary=True
                )

            # Create AuditLog
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Child Admission",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values=None
            )

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        if not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to perform this action.")
            
        student = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Student Profile Updated",
            module="Child Management",
            entity_type="Student",
            entity_id=str(student.id),
            old_values=None
        )

    def perform_destroy(self, instance):
        if not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to perform this action.")
            
        from django.utils import timezone
        instance.deleted_at = timezone.now()
        instance.save()
        
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Soft Deleted Student",
            module="Child Management",
            entity_type="Student",
            entity_id=str(instance.id),
            old_values={"first_name": instance.first_name, "last_name": instance.last_name}
        )

    from rest_framework.decorators import action
    @action(detail=True, methods=['post'])
    def photo(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        photo_file = request.FILES.get('photo')
        if photo_file:
            # Simple handling for local development (ideally use proper storage backend)
            from django.core.files.storage import default_storage
            
            path = default_storage.save(f'students/photos/{student.id}_{photo_file.name}', photo_file)
            photo_url = default_storage.url(path)
            
            student.photo = photo_url
            student.save()
            return Response({"photo": photo_url})
        return Response({"error": "No photo provided"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'put', 'patch'])
    def medical(self, request, pk=None):
        from .models import HealthProfile
        from .serializers import HealthProfileSerializer
        student = self.get_object()
        
        # Get or create the HealthProfile
        health_profile, created = HealthProfile.objects.get_or_create(
            daycare=request.user.daycare, 
            student=student
        )
        
        if request.method == 'GET':
            hp_data = HealthProfileSerializer(health_profile).data
            # Merge student fields
            student_medical_data = {
                'allergies': student.allergies,
                'medical_conditions': student.medical_conditions,
                'medication': student.medication,
                'special_needs': student.special_needs,
                'dietary_restrictions': student.dietary_restrictions,
                'doctor_name': student.doctor_name,
                'doctor_phone': student.doctor_phone,
                'hospital_name': student.hospital_name,
            }
            # Handle masking for non-staff
            if not request.user.is_staff:
                if hp_data.get('ohip_number'):
                    hp_data['ohip_number'] = '***-***-***'
            
            combined_data = {**hp_data, **student_medical_data}
            return Response(combined_data)
            
        elif request.method in ['PUT', 'PATCH']:
            if not request.user.is_staff:
                return Response({"detail": "You do not have permission to edit medical information."}, status=status.HTTP_403_FORBIDDEN)
                
            student_data = {
                'allergies': request.data.get('allergies', student.allergies),
                'medical_conditions': request.data.get('medical_conditions', student.medical_conditions),
                'medication': request.data.get('medication', student.medication),
                'special_needs': request.data.get('special_needs', student.special_needs),
                'dietary_restrictions': request.data.get('dietary_restrictions', student.dietary_restrictions),
                'doctor_name': request.data.get('doctor_name', student.doctor_name),
                'doctor_phone': request.data.get('doctor_phone', student.doctor_phone),
                'hospital_name': request.data.get('hospital_name', student.hospital_name),
            }
            
            changes = []
            for attr, value in student_data.items():
                old_val = getattr(student, attr)
                if old_val != value:
                    changes.append(f"{attr}: '{old_val}' -> '{value}'")
                setattr(student, attr, value)
            student.save()
            
            serializer = HealthProfileSerializer(health_profile, data=request.data, partial=True)
            if serializer.is_valid():
                # Track HP changes
                for field, new_val in serializer.validated_data.items():
                    old_val = getattr(health_profile, field)
                    if old_val != new_val:
                        changes.append(f"hp_{field}: '{old_val}' -> '{new_val}'")
                
                serializer.save()
                
                if changes:
                    AuditLog.objects.create(
                        user=request.user,
                        user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                        action="Updated Medical Info",
                        module="Child Management",
                        entity_type="Student",
                        entity_id=str(student.id),
                        old_values={'details': changes}
                    )
                
                hp_data = serializer.data
                combined_data = {**hp_data, **student_data}
                return Response(combined_data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        withdrawal_date = request.data.get('withdrawal_date')
        reason = request.data.get('reason')
        notes = request.data.get('notes')

        if not withdrawal_date or not reason:
            return Response({"detail": "Withdrawal date and reason are required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            old_status = student.status
            student.status = 'Withdrawn'
            student.save()
            
            # Update active enrollment
            active_enrollment = student.enrollments.filter(status='Active').order_by('-created_at').first()
            if active_enrollment:
                active_enrollment.status = 'Withdrawn'
                active_enrollment.end_date = withdrawal_date
                active_enrollment.withdrawal_reason = reason
                active_enrollment.notes = notes
                active_enrollment.save()
            
            # Log action
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Child Withdrawal",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values={"status": old_status},
                new_values={"status": "Withdrawn", "withdrawal_date": withdrawal_date, "reason": reason}
            )
            
        return Response({"status": "Student withdrawn"})

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        new_branch_id = request.data.get('branch_id')
        classroom_id = request.data.get('classroom_id')
        transfer_date = request.data.get('transfer_date')

        if not transfer_date:
            return Response({"detail": "Transfer date is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not new_branch_id and not classroom_id:
            return Response({"detail": "Either Branch ID or Classroom ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Branch Transfer
            if new_branch_id:
                try:
                    new_branch = Branch.objects.get(id=new_branch_id, daycare=request.user.daycare)
                except Branch.DoesNotExist:
                    return Response({"detail": "Branch not found or belongs to a different daycare."}, status=status.HTTP_400_BAD_REQUEST)
                
                if new_branch.daycare != student.daycare:
                    return Response({"detail": "Cannot transfer to a branch belonging to a different daycare."}, status=status.HTTP_400_BAD_REQUEST)
                    
                old_branch = student.branch.name if student.branch else "None"
                student.branch = new_branch
                student.save()
                
                # End active enrollment
                active_enrollment = student.enrollments.filter(status='Active').order_by('-created_at').first()
                if active_enrollment:
                    active_enrollment.status = 'Transferred'
                    active_enrollment.end_date = transfer_date
                    active_enrollment.save()
                    
                # Create new enrollment for new branch
                ChildEnrollment.objects.create(
                    student=student,
                    start_date=transfer_date,
                    status='Active',
                    notes=f"Transferred from {old_branch} to {new_branch.name}"
                )
                
                AuditLog.objects.create(
                    user=request.user,
                    user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                    action="Branch Transfer",
                    module="Child Management",
                    entity_type="Student",
                    entity_id=str(student.id),
                    old_values={"branch": old_branch},
                    new_values={"branch": new_branch.name}
                )

            # Classroom Transfer
            if classroom_id:
                try:
                    classroom = Classroom.objects.get(id=classroom_id, daycare=request.user.daycare)
                except Classroom.DoesNotExist:
                    return Response({"detail": "Classroom not found or belongs to a different daycare."}, status=status.HTTP_400_BAD_REQUEST)
                
                if classroom.daycare != student.daycare:
                    return Response({"detail": "Cannot transfer to a classroom belonging to a different daycare."}, status=status.HTTP_400_BAD_REQUEST)

                # End active classroom assignments
                active_assignments = ClassroomStudent.objects.filter(student=student, status='Active')
                old_classroom_names = []
                for assignment in active_assignments:
                    old_classroom_names.append(assignment.classroom.room_name)
                    assignment.status = 'Ended'
                    assignment.end_date = transfer_date
                    assignment.save()
                    
                old_classroom_str = ", ".join(old_classroom_names) if old_classroom_names else "None"

                # Assign new classroom
                ClassroomStudent.objects.create(
                    student=student,
                    classroom=classroom,
                    start_date=transfer_date,
                    status='Active'
                )

                AuditLog.objects.create(
                    user=request.user,
                    user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                    action="Classroom Transfer",
                    module="Child Management",
                    entity_type="Student",
                    entity_id=str(student.id),
                    old_values={"classroom": old_classroom_str},
                    new_values={"classroom": classroom.room_name}
                )

        return Response({"status": "Student transferred successfully"})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        
        with transaction.atomic():
            old_status = student.status
            student.status = 'Archived'
            student.save()
            
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Archived Student",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values={"status": old_status}
            )
            
        return Response({"status": "Student archived"})

    @action(detail=True, methods=['post'])
    def unarchive(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        if student.status != 'Archived':
            return Response({"detail": "Student is not archived."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            has_active = student.enrollments.filter(status='Active').exists()
            new_status = 'Active' if has_active else 'Withdrawn'
            
            student.status = new_status
            student.save()
            
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Restored Student",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values={"status": "Archived"},
                new_values={"status": new_status}
            )
            
        return Response({"status": f"Student restored to {new_status}"})

    @action(detail=True, methods=['post'])
    def re_enroll(self, request, pk=None):
        if not request.user.is_staff:
            return Response({"detail": "You do not have permission to perform this action."}, status=status.HTTP_403_FORBIDDEN)
            
        student = self.get_object()
        start_date = request.data.get('start_date')
        
        if not start_date:
            return Response({"detail": "Start date is required for re-enrollment."}, status=status.HTTP_400_BAD_REQUEST)
            
        if student.status == 'Active':
            return Response({"detail": "Student is already active."}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            old_status = student.status
            student.status = 'Active'
            student.save()
            
            # End previous active enrollments if any
            student.enrollments.filter(status='Active').update(status='Ended', end_date=start_date)
            
            ChildEnrollment.objects.create(
                student=student,
                start_date=start_date,
                status='Active',
                notes="Re-enrolled"
            )
            
            AuditLog.objects.create(
                user=request.user,
                user_type=request.user.role if hasattr(request.user, 'role') else 'Daycare Admin',
                action="Re-enrolled Student",
                module="Child Management",
                entity_type="Student",
                entity_id=str(student.id),
                old_values={"status": old_status}
            )
            
        return Response({"status": "Student re-enrolled"})

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        student = self.get_object()
        
        classroom_ids = list(student.classroom_enrollments.values_list('id', flat=True)) if hasattr(student, 'classroom_enrollments') else []
        contact_ids = list(student.emergency_contacts.values_list('id', flat=True)) if hasattr(student, 'emergency_contacts') else []
        pickup_ids = list(student.pickups.values_list('id', flat=True)) if hasattr(student, 'pickups') else []
        
        from django.contrib.contenttypes.models import ContentType
        from .models import Document, ChildVaccinationRecord, AuditLog
        from django.db.models import Q
        
        hp_id = None
        if hasattr(student, 'health_profile'):
            hp_id = student.health_profile.id
            
        student_ct = ContentType.objects.get_for_model(Student)
        document_ids = list(Document.objects.filter(content_type=student_ct, object_id=student.id).values_list('id', flat=True))
        vaccination_ids = list(ChildVaccinationRecord.objects.filter(student=student).values_list('id', flat=True))
        
        q_filters = Q(entity_type='Student', entity_id=str(student.id))
        
        if classroom_ids:
            q_filters |= Q(entity_type='ClassroomStudent', entity_id__in=[str(cid) for cid in classroom_ids])
        if contact_ids:
            q_filters |= Q(entity_type='StudentEmergencyContact', entity_id__in=[str(cid) for cid in contact_ids])
        if pickup_ids:
            q_filters |= Q(entity_type='StudentPickup', entity_id__in=[str(pid) for pid in pickup_ids])
        if hp_id:
            q_filters |= Q(entity_type='HealthProfile', entity_id=str(hp_id))
        if document_ids:
            q_filters |= Q(entity_type='Document', entity_id__in=[str(did) for did in document_ids])
        if vaccination_ids:
            q_filters |= Q(entity_type='ChildVaccinationRecord', entity_id__in=[str(vid) for vid in vaccination_ids])
            
        logs = AuditLog.objects.filter(q_filters).order_by('-created_at')
        
        history_data = []
        for log in logs:
            performed_by = log.user.get_full_name() if log.user and (log.user.first_name or log.user.last_name) else (log.user.username if log.user else 'System')
            
            new_vals = log.new_values if isinstance(log.new_values, dict) else {}
            old_vals = log.old_values if isinstance(log.old_values, dict) else {}
            
            details = ""
            if log.action == "Child Admission":
                details = "Child profile created with status: Active."
            elif log.action == "Student Profile Updated":
                details = "Basic profile information updated."
            elif log.action == "Updated Medical Info":
                details = "Medical and health information updated."
            elif log.action in ["Withdrew Student", "Child Withdrawal"]:
                reason_str = f" Reason: {new_vals.get('reason')}" if new_vals.get('reason') else ""
                details = f"Withdrawn from daycare.{reason_str}"
            elif log.action in ["Transferred Student", "Branch Transfer"]:
                details = f"Transferred to branch: {new_vals.get('branch', 'New Branch')}."
            elif log.action == "Classroom Transfer":
                details = f"Transferred to classroom: {new_vals.get('classroom', 'New Classroom')}."
            elif log.action == "Archived Student":
                details = "Student profile archived."
            elif log.action == "Restored Student":
                details = "Student profile unarchived."
            elif log.action == "Re-enrolled Student":
                details = "Student re-enrolled in daycare."
            elif log.action == "Assigned Classroom":
                details = "Assigned to a new classroom."
            elif log.action == "Deleted Classroom Assignment":
                details = "Classroom assignment ended."
            elif log.action == "Added Emergency Contact":
                details = "New emergency contact added."
            elif log.action == "Updated Emergency Contact":
                details = "Emergency contact details updated."
            elif log.action == "Deleted Emergency Contact":
                details = f"Emergency contact deleted (Name: {old_vals.get('name', 'N/A')})."
            elif log.action == "Added Authorized Pickup":
                details = "New authorized pickup contact added."
            elif log.action == "Updated Authorized Pickup":
                details = "Authorized pickup details updated."
            elif log.action == "Deleted Authorized Pickup":
                details = f"Authorized pickup deleted (Name: {old_vals.get('name', 'N/A')})."
            elif log.action == "Uploaded Document":
                details = "New document uploaded."
            elif log.action == "Updated Document":
                details = "Document details updated."
            elif log.action == "Deleted Document":
                details = f"Document deleted (Title: {old_vals.get('title', 'N/A')})."
            elif log.action == "Added Vaccination Record":
                details = "New vaccination record added."
            elif log.action == "Updated Vaccination Record":
                details = "Vaccination record updated."
            elif log.action == "Deleted Vaccination Record":
                details = f"Vaccination record deleted (Vaccine: {old_vals.get('vaccine', 'N/A')})."
            else:
                details = log.action
                
            history_data.append({
                "id": str(log.id),
                "date": log.created_at.isoformat() if log.created_at else "",
                "event": log.action,
                "performed_by": performed_by,
                "details": details
            })
            
        if not history_data:
            admission_dt = student.admission_date or student.created_at
            history_data.append({
                "id": f"adm-{student.id}",
                "date": admission_dt.isoformat() if admission_dt else "",
                "event": "Child Admission",
                "performed_by": "Daycare Admin",
                "details": f"Child profile created with status: {student.status}."
            })
            
        return Response(history_data)


    @action(detail=True, methods=['get'])
    def guardians(self, request, pk=None):
        student = self.get_object()
        fc = FamilyChild.objects.filter(student=student).first()
        if not fc:
            return Response([])
        
        fgs = FamilyGuardian.objects.filter(family=fc.family)
        guardians = [fg.guardian for fg in fgs]
        
        from .serializers import GuardianSerializer
        serializer = GuardianSerializer(guardians, many=True, context={'family': fc.family})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_guardian(self, request, pk=None):
        from .models import User, Guardian, Family, FamilyChild, FamilyGuardian, GuardianCommunicationPreference
        from django.utils import timezone
        from django.db import transaction
        student = self.get_object()
        
        email = (request.data.get('email') or '').strip().lower()
        password = request.data.get('password')
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        relationship = request.data.get('relationship', 'Parent') or 'Parent'
        phone = request.data.get('phone', '')

        if not all([email, password, first_name, last_name]):
            return Response({'detail': 'Please provide all required fields (first_name, last_name, email, password).'}, status=400)

        now = timezone.now()
        daycare = student.daycare or request.user.daycare

        with transaction.atomic():
            # Check if user already exists
            user = User.objects.filter(email__iexact=email).first()
            if user:
                guardian = Guardian.objects.filter(user=user).first()
                if not guardian:
                    guardian = Guardian.objects.filter(email__iexact=email).first()
                    if not guardian:
                        guardian = Guardian.objects.create(
                            user=user,
                            daycare=daycare,
                            first_name=first_name,
                            last_name=last_name,
                            email=email,
                            phone=phone,
                            status='Active'
                        )
                        GuardianCommunicationPreference.objects.create(
                            guardian=guardian,
                            email_alerts=True,
                            sms_alerts=True,
                            emergency_alerts_only=False,
                            created_at=now,
                            updated_at=now
                        )
                    else:
                        guardian.user = user
                        guardian.save()
            else:
                # Create new user and guardian
                user = User.objects.create_user(
                    username=email,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    daycare=daycare,
                    is_active=True
                )
                
                guardian = Guardian.objects.create(
                    user=user,
                    daycare=daycare,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    status='Active'
                )
                GuardianCommunicationPreference.objects.create(
                    guardian=guardian,
                    email_alerts=True,
                    sms_alerts=True,
                    emergency_alerts_only=False,
                    created_at=now,
                    updated_at=now
                )

            # Handle Family Association
            fc = FamilyChild.objects.filter(student=student).first()
            if not fc:
                family = Family.objects.create(
                    daycare=daycare,
                    family_name=f"{student.last_name or student.first_name} Family",
                    status='Active',
                    primary_contact=f"{first_name} {last_name}".strip(),
                    primary_email=email,
                    primary_phone=phone,
                    created_at=now,
                    updated_at=now
                )
                FamilyChild.objects.create(
                    family=family,
                    student=student,
                    created_at=now
                )
            else:
                family = fc.family

            # Link Guardian to Family if not already linked
            fg, created = FamilyGuardian.objects.get_or_create(
                family=family,
                guardian=guardian,
                defaults={
                    'relationship': relationship,
                    'is_primary': True,
                    'status': 'Active',
                    'created_at': now
                }
            )
            if not created:
                fg.relationship = relationship
                fg.status = 'Active'
                fg.save()
                
        return Response({'status': 'Guardian added successfully'})


    @action(detail=True, methods=['post'])
    def remove_guardian(self, request, pk=None):
        from .models import FamilyChild, FamilyGuardian
        student = self.get_object()
        guardian_id = request.data.get('guardian_id')
        
        fc = FamilyChild.objects.filter(student=student).first()
        if not fc:
            return Response({'detail': 'No family found for this student.'}, status=400)
            
        fg = FamilyGuardian.objects.filter(family=fc.family, guardian__id=guardian_id).first()
        if not fg:
            return Response({'detail': 'Guardian not found in this family.'}, status=404)
            
        fg.delete()
        return Response({'status': 'Guardian removed successfully'})

class ChildEmergencyContactViewSet(viewsets.ModelViewSet):
    from .serializers import StudentEmergencyContactSerializer
    from .models import StudentEmergencyContact, Student
    from .permissions import IsDaycareAdmin
    serializer_class = StudentEmergencyContactSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        # If 'child_pk' is present in kwargs, it's a nested route
        if 'child_pk' in self.kwargs:
            return StudentEmergencyContact.objects.filter(
                student_id=self.kwargs['child_pk'],
                student__daycare=daycare
            )
        # Otherwise, standard detail route
        return StudentEmergencyContact.objects.filter(
            student__daycare=daycare
        )

    def perform_create(self, serializer):
        student = get_object_or_404(
            Student,
            id=self.kwargs.get('child_pk'),
            daycare=self.request.user.daycare
        )
        
        # If set as primary, unset others
        if serializer.validated_data.get('is_primary'):
            student.emergency_contacts.update(is_primary=False)
            
        contact = serializer.save(student=student)
        
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Added Emergency Contact",
            module="Child Management",
            entity_type="StudentEmergencyContact",
            entity_id=str(contact.id),
            old_values=None
        )

    def perform_update(self, serializer):
        # If set as primary, unset others
        if serializer.validated_data.get('is_primary'):
            contact = self.get_object()
            contact.student.emergency_contacts.exclude(id=contact.id).update(is_primary=False)
            
        contact = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Updated Emergency Contact",
            module="Child Management",
            entity_type="StudentEmergencyContact",
            entity_id=str(contact.id),
            old_values=None
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Deleted Emergency Contact",
            module="Child Management",
            entity_type="StudentEmergencyContact",
            entity_id=str(instance.id),
            old_values={"name": instance.name, "phone": instance.mobile}
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None, child_pk=None):
        from rest_framework.response import Response
        contact = self.get_object()
        if contact.approval_status == 'Pending':
            if contact.pending_changes:
                for k, v in contact.pending_changes.items():
                    setattr(contact, k, v)
                contact.pending_changes = None
            contact.approval_status = 'Approved'
            contact.save()
            return Response({'status': 'approved'})
        elif contact.approval_status == 'Pending_Removal':
            contact.delete()
            return Response({'status': 'removed'})
        return Response({'error': 'No pending changes'}, status=400)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None, child_pk=None):
        from rest_framework.response import Response
        contact = self.get_object()
        if contact.approval_status in ['Pending', 'Pending_Removal']:
            contact.pending_changes = None
            contact.approval_status = 'Approved'
            contact.save()
            return Response({'status': 'rejected'})
        return Response({'error': 'No pending changes'}, status=400)


class ChildAuthorizedPickupViewSet(viewsets.ModelViewSet):
    from .serializers import StudentPickupSerializer
    from .models import StudentPickup, Student
    from .permissions import IsDaycareAdmin
    serializer_class = StudentPickupSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        if 'child_pk' in self.kwargs:
            return StudentPickup.objects.filter(
                student_id=self.kwargs['child_pk'],
                student__daycare=daycare
            )
        return StudentPickup.objects.filter(
            student__daycare=daycare
        )

    def perform_create(self, serializer):
        student = get_object_or_404(
            Student,
            id=self.kwargs.get('child_pk'),
            daycare=self.request.user.daycare
        )
        pickup = serializer.save(student=student)
        
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Added Authorized Pickup",
            module="Child Management",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values=None
        )

    def perform_update(self, serializer):
        pickup = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Updated Authorized Pickup",
            module="Child Management",
            entity_type="StudentPickup",
            entity_id=str(pickup.id),
            old_values=None
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Deleted Authorized Pickup",
            module="Child Management",
            entity_type="StudentPickup",
            entity_id=str(instance.id),
            old_values={"name": instance.name}
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None, child_pk=None):
        from rest_framework.response import Response
        pickup = self.get_object()
        if pickup.approval_status == 'Pending':
            if pickup.pending_changes:
                for k, v in pickup.pending_changes.items():
                    setattr(pickup, k, v)
                pickup.pending_changes = None
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'approved'})
        elif pickup.approval_status == 'Pending_Removal':
            pickup.delete()
            return Response({'status': 'removed'})
        return Response({'error': 'No pending changes'}, status=400)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None, child_pk=None):
        from rest_framework.response import Response
        pickup = self.get_object()
        if pickup.approval_status in ['Pending', 'Pending_Removal']:
            pickup.pending_changes = None
            pickup.approval_status = 'Approved'
            pickup.save()
            return Response({'status': 'rejected'})
        return Response({'error': 'No pending changes'}, status=400)

from django.contrib.contenttypes.models import ContentType
from django.http import FileResponse
import mimetypes

class ChildDocumentViewSet(viewsets.ModelViewSet):
    from .models import Document, Student
    from .serializers import ChildDocumentSerializer
    from .permissions import IsDaycareAdmin
    serializer_class = ChildDocumentSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        from .models import Student
        content_type = ContentType.objects.get_for_model(Student)
        if 'child_pk' in self.kwargs:
            from .models import Document
            return Document.objects.filter(
                daycare=daycare,
                content_type=content_type,
                object_id=self.kwargs['child_pk']
            )
        from .models import Document
        return Document.objects.filter(daycare=daycare, content_type=content_type)

    def perform_create(self, serializer):
        from .models import Student
        from django.shortcuts import get_object_or_404
        student = get_object_or_404(Student, id=self.kwargs.get('child_pk'), daycare=self.request.user.daycare)
        content_type = ContentType.objects.get_for_model(Student)
        document = serializer.save(
            daycare=self.request.user.daycare,
            content_type=content_type,
            object_id=student.id,
            uploaded_by=self.request.user
        )
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Uploaded Document",
            module="Child Management",
            entity_type="Document",
            entity_id=str(document.id),
            old_values=None
        )

    def perform_update(self, serializer):
        document = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Updated Document",
            module="Child Management",
            entity_type="Document",
            entity_id=str(document.id),
            old_values=None
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Deleted Document",
            module="Child Management",
            entity_type="Document",
            entity_id=str(instance.id),
            old_values={"title": instance.title}
        )
        instance.delete()


class SecureDocumentDownloadView(APIView):
    from .models import Document
    from .permissions import IsDaycareAdmin
    permission_classes = [IsDaycareAdmin]

    def get(self, request, pk):
        from .models import Document
        from django.shortcuts import get_object_or_404
        document = get_object_or_404(Document, id=pk, daycare=request.user.daycare)
        
        try:
            file_handle = document.file_path.open('rb')
            response = FileResponse(file_handle)
            content_type, encoding = mimetypes.guess_type(document.file_path.name)
            response['Content-Type'] = content_type or 'application/octet-stream'
            response['Content-Disposition'] = f'attachment; filename="{document.file_path.name.split("/")[-1]}"'
            
            AuditLog.objects.create(
                user=self.request.user,
                user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
                action="Downloaded Document",
                module="Child Management",
                entity_type="Document",
                entity_id=str(document.id),
                old_values=None
            )
            return response
        except Exception as e:
            return Response({"error": "File not found"}, status=status.HTTP_404_NOT_FOUND)


class ChildVaccinationViewSet(viewsets.ModelViewSet):
    from .serializers import ChildVaccinationRecordSerializer
    from .models import ChildVaccinationRecord, Student
    from .permissions import IsDaycareAdmin
    serializer_class = ChildVaccinationRecordSerializer
    permission_classes = [IsDaycareAdmin]

    def get_queryset(self):
        daycare = self.request.user.daycare
        from .models import ChildVaccinationRecord
        if 'child_pk' in self.kwargs:
            return ChildVaccinationRecord.objects.filter(
                student_id=self.kwargs['child_pk'],
                student__daycare=daycare
            )
        return ChildVaccinationRecord.objects.filter(student__daycare=daycare)

    def perform_create(self, serializer):
        from .models import Student
        from django.shortcuts import get_object_or_404
        from django.utils import timezone
        daycare = getattr(self.request.user, 'daycare', None)
        if self.request.user.is_superuser and not daycare:
            student = get_object_or_404(Student, id=self.kwargs.get('child_pk'))
        else:
            student = get_object_or_404(Student, id=self.kwargs.get('child_pk'), daycare=daycare)
            
        now = timezone.now()
        vaccination = serializer.save(
            student=student,
            created_at=now,
            updated_at=now
        )
        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Added Vaccination Record",
            module="Child Management",
            entity_type="ChildVaccinationRecord",
            entity_id=str(vaccination.id),
            old_values=None
        )

    def perform_update(self, serializer):
        from django.utils import timezone
        now = timezone.now()
        vaccination = serializer.save(updated_at=now)
        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Updated Vaccination Record",
            module="Child Management",
            entity_type="ChildVaccinationRecord",
            entity_id=str(vaccination.id),
            old_values=None
        )


    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Deleted Vaccination Record",
            module="Child Management",
            entity_type="ChildVaccinationRecord",
            entity_id=str(instance.id),
            old_values={"vaccine": instance.vaccine_name}
        )
        instance.delete()

from .serializers import SimpleClassroomSerializer, ChildClassroomAssignmentSerializer
from .models import Classroom, ClassroomStudent
from .permissions import IsDaycareAdmin
from django.utils import timezone
from rest_framework.exceptions import ValidationError

class SimpleClassroomViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SimpleClassroomSerializer
    permission_classes = [IsDaycareAdmin]
    
    def get_queryset(self):
        return Classroom.objects.filter(daycare=self.request.user.daycare)

class ChildClassroomViewSet(viewsets.ModelViewSet):
    serializer_class = ChildClassroomAssignmentSerializer
    permission_classes = [IsDaycareAdmin]
    
    def get_queryset(self):
        daycare = self.request.user.daycare
        if 'child_pk' in self.kwargs:
            return ClassroomStudent.objects.filter(
                student_id=self.kwargs['child_pk'],
                classroom__daycare=daycare
            ).order_by('-start_date', '-created_at')
        return ClassroomStudent.objects.filter(classroom__daycare=daycare).order_by('-start_date', '-created_at')

    def perform_create(self, serializer):
        student = get_object_or_404(
            Student,
            id=self.kwargs.get('child_pk'),
            daycare=self.request.user.daycare
        )
        classroom = serializer.validated_data.get('classroom')
        
        if classroom.daycare_id != self.request.user.daycare_id:
            raise ValidationError("Classroom does not belong to this daycare.")
            
        # Capacity validation
        active_students_count = ClassroomStudent.objects.filter(
            classroom=classroom,
            status='Active'
        ).exclude(student=student).count()
        if classroom.capacity is not None and classroom.capacity > 0 and active_students_count >= classroom.capacity:
            raise ValidationError(f"Classroom '{classroom.room_name}' is at full capacity ({classroom.capacity} students).")
            
        today = timezone.now().date()
        start_date = serializer.validated_data.get('start_date', today) or today
        
        # End any currently active assignments for this student
        active_assignments = ClassroomStudent.objects.filter(
            student=student,
            status='Active'
        ).exclude(classroom=classroom)
        for assignment in active_assignments:
            assignment.status = 'Ended'
            if not assignment.end_date:
                assignment.end_date = today
            assignment.save()
            
        # Check if an assignment already exists for this (classroom, student)
        existing = ClassroomStudent.objects.filter(classroom=classroom, student=student).first()
        if existing:
            existing.status = 'Active'
            existing.start_date = start_date
            existing.end_date = None
            existing.save()
            serializer.instance = existing
            assignment = existing
        else:
            assignment = serializer.save(
                student=student,
                status='Active',
                start_date=start_date
            )
            
        AuditLog.objects.create(
            user=self.request.user,
            user_type=getattr(self.request.user, 'role', 'Staff') or 'Staff',
            action="Assigned Classroom",
            module="Child Management",
            entity_type="ClassroomStudent",
            entity_id=str(assignment.id),
            old_values=None
        )


    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type=self.request.user.role if hasattr(self.request.user, 'role') else 'Daycare Admin',
            action="Deleted Classroom Assignment",
            module="Child Management",
            entity_type="ClassroomStudent",
            entity_id=str(instance.id),
            old_values=None
        )
        instance.delete()

class ChildEnrollmentViewSet(viewsets.ReadOnlyModelViewSet):
    from .serializers import ChildEnrollmentSerializer
    from .models import ChildEnrollment
    from .permissions import IsDaycareAdmin
    serializer_class = ChildEnrollmentSerializer
    permission_classes = [IsDaycareAdmin]
    
    def get_queryset(self):
        daycare = self.request.user.daycare
        if 'child_pk' in self.kwargs:
            return self.ChildEnrollment.objects.filter(
                student_id=self.kwargs['child_pk'],
                student__daycare=daycare
            ).order_by('-created_at')
        return self.ChildEnrollment.objects.none()

import secrets
from rest_framework import serializers, permissions
from .permissions import IsAuthenticatedGuardian
from .serializers import FamilySerializer, GuardianSerializer
from .models import Family, Guardian, FamilyGuardian, GuardianCommunicationPreference, GuardianInvitation, GuardianPasswordResetToken, FamilyChild

class FamilyProfileView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)
        
        family = family_guardian.family
        serializer = FamilySerializer(family)
        return Response(serializer.data)

    def patch(self, request):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)

        family = family_guardian.family
        serializer = FamilySerializer(family, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FamilyGuardiansView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)

        family = family_guardian.family
        guardians = [fg.guardian for fg in family.family_guardians.all()]
        serializer = GuardianSerializer(guardians, many=True, context={'family': family})
        return Response(serializer.data)

    def post(self, request):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)

        family = family_guardian.family
        daycare = request.user.daycare
        
        data = request.data
        email = data.get('email')
        
        if email and Guardian.objects.filter(email=email).exists():
            return Response({"detail": "Guardian with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        if email:
            if User.objects.filter(email=email).exists() or User.objects.filter(username=email).exists():
                return Response({"detail": "User with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
            
            user = User.objects.create_user(
                username=email,
                email=email,
                password='TempPass123!',
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                is_staff=False,
                daycare=daycare
            )

        new_guardian = Guardian.objects.create(
            user=user,
            daycare=daycare,
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            preferred_name=data.get('preferred_name'),
            email=email,
            phone=data.get('phone')
        )

        now = timezone.now()
        FamilyGuardian.objects.create(
            family=family,
            guardian=new_guardian,
            relationship=data.get('relationship', 'Guardian'),
            is_primary=data.get('is_primary', False),
            status='Active',
            created_at=now
        )

        prefs = data.get('communication_preferences', {})
        GuardianCommunicationPreference.objects.create(
            guardian=new_guardian,
            email_alerts=prefs.get('email_alerts', True),
            sms_alerts=prefs.get('sms_alerts', False),
            emergency_alerts_only=prefs.get('emergency_alerts_only', False),
            created_at=now,
            updated_at=now
        )


        serializer = GuardianSerializer(new_guardian, context={'family': family})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class FamilyGuardianDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def patch(self, request, pk):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)

        family = family_guardian.family
        
        fg_target = FamilyGuardian.objects.filter(family=family, guardian_id=pk).first()
        if not fg_target:
            return Response({"detail": "Guardian not found in your family."}, status=status.HTTP_404_NOT_FOUND)

        target_guardian = fg_target.guardian
        data = request.data
        audit_details = []

        if 'first_name' in data and target_guardian.first_name != data['first_name']:
            audit_details.append(f"First name changed from {target_guardian.first_name} to {data['first_name']}")
            target_guardian.first_name = data['first_name']
        if 'last_name' in data and target_guardian.last_name != data['last_name']:
            audit_details.append(f"Last name changed from {target_guardian.last_name} to {data['last_name']}")
            target_guardian.last_name = data['last_name']
        if 'preferred_name' in data and target_guardian.preferred_name != data['preferred_name']:
            audit_details.append(f"Preferred name changed to {data['preferred_name']}")
            target_guardian.preferred_name = data['preferred_name']
        if 'phone' in data and target_guardian.phone != data['phone']:
            audit_details.append(f"Phone changed to {data['phone']}")
            target_guardian.phone = data['phone']
        
        target_guardian.save()

        if 'relationship' in data and fg_target.relationship != data['relationship']:
            old_rel = fg_target.relationship
            new_rel = data['relationship']
            audit_details.append(f"Relationship changed from {old_rel} to {new_rel}")
            fg_target.relationship = new_rel
            
            if old_rel in ['Mother', 'Father'] or new_rel in ['Mother', 'Father']:
                fg_target.status = 'Pending_Approval'
                audit_details.append("Status set to Pending_Approval due to sensitive relationship change")
        
        if 'is_primary' in data and fg_target.is_primary != data['is_primary']:
            if not data['is_primary']:
                active_primaries = FamilyGuardian.objects.filter(family=family, is_primary=True, status='Active').exclude(id=fg_target.id).count()
                if active_primaries == 0:
                    return Response({"detail": "Cannot remove the last active primary guardian from the family."}, status=status.HTTP_400_BAD_REQUEST)
            audit_details.append(f"Primary status changed to {data['is_primary']}")
            fg_target.is_primary = data['is_primary']
            
        fg_target.save()

        if 'communication_preferences' in data:
            prefs = data['communication_preferences']
            pref_obj, _ = GuardianCommunicationPreference.objects.get_or_create(guardian=target_guardian)
            prefs_changed = False
            if 'email_alerts' in prefs and pref_obj.email_alerts != prefs['email_alerts']:
                pref_obj.email_alerts = prefs['email_alerts']
                prefs_changed = True
            if 'sms_alerts' in prefs and pref_obj.sms_alerts != prefs['sms_alerts']:
                pref_obj.sms_alerts = prefs['sms_alerts']
                prefs_changed = True
            if 'emergency_alerts_only' in prefs and pref_obj.emergency_alerts_only != prefs['emergency_alerts_only']:
                pref_obj.emergency_alerts_only = prefs['emergency_alerts_only']
                prefs_changed = True
            pref_obj.save()
            if prefs_changed:
                audit_details.append("Communication preferences updated")

        if audit_details:
            from .models import FamilyAuditLog
            FamilyAuditLog.objects.create(
                family=family,
                actor=request.user,
                action=f"Updated guardian {target_guardian.first_name} {target_guardian.last_name}",
                details="; ".join(audit_details)
            )

        serializer = GuardianSerializer(target_guardian, context={'family': family})
        return Response(serializer.data)

    def delete(self, request, pk):
        guardian = request.user.guardian_profile
        family_guardian = guardian.guardian_families.first()
        if not family_guardian:
            return Response({"detail": "Family relationship not found."}, status=status.HTTP_404_NOT_FOUND)

        family = family_guardian.family
        
        fg_target = FamilyGuardian.objects.filter(family=family, guardian_id=pk).first()
        if not fg_target:
            return Response({"detail": "Guardian not found in your family."}, status=status.HTTP_404_NOT_FOUND)
            
        if fg_target.is_primary:
            active_primaries = FamilyGuardian.objects.filter(family=family, is_primary=True, status='Active').exclude(id=fg_target.id).count()
            if active_primaries == 0:
                return Response({"detail": "Cannot deactivate the last active primary guardian from the family."}, status=status.HTTP_400_BAD_REQUEST)
                
        fg_target.status = 'Inactive'
        fg_target.save()
        
        from .models import FamilyAuditLog
        FamilyAuditLog.objects.create(
            family=family,
            actor=request.user,
            action=f"Deactivated guardian",
            details=f"Guardian {fg_target.guardian.first_name} {fg_target.guardian.last_name} was deactivated."
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

class GuardianInvitationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    invited_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = GuardianInvitation
        fields = ['id', 'email', 'student', 'student_name', 'relationship', 'token', 'status', 'invited_by_name', 'created_at', 'expires_at', 'is_expired']
        read_only_fields = ['id', 'token', 'status', 'invited_by_name', 'created_at', 'expires_at', 'is_expired']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else ""

    def get_invited_by_name(self, obj):
        return f"{obj.invited_by.first_name} {obj.invited_by.last_name}" if obj.invited_by else ""

    def get_is_expired(self, obj):
        if not obj.expires_at:
            return False
        from django.utils import timezone
        return obj.expires_at < timezone.now()

class DaycareInvitationsView(APIView):
    permission_classes = [IsDaycareAdmin]

    def get(self, request):
        daycare = request.user.daycare
        student_id = request.query_params.get('student_id')
        
        invitations = GuardianInvitation.objects.filter(daycare=daycare)
        if student_id:
            invitations = invitations.filter(student_id=student_id)
        
        invitations = invitations.order_by('-created_at')
        serializer = GuardianInvitationSerializer(invitations, many=True)
        return Response(serializer.data)

    def post(self, request):
        daycare = request.user.daycare
        data = request.data
        student_id = data.get('student')
        email = data.get('email')
        relationship = data.get('relationship', 'Guardian')

        if not student_id or not email:
            return Response({"detail": "Student ID and email are required."}, status=status.HTTP_400_BAD_REQUEST)

        student = Student.objects.filter(id=student_id, daycare=daycare).first()
        if not student:
            return Response({"detail": "Student not found in your daycare."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        existing = GuardianInvitation.objects.filter(
            daycare=daycare,
            email=email,
            student=student,
            status='pending',
            expires_at__gt=now
        ).exists()
        
        if existing:
            return Response({"detail": "A pending invitation already exists for this guardian and child."}, status=status.HTTP_400_BAD_REQUEST)

        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(days=2)

        invitation = GuardianInvitation.objects.create(
            daycare=daycare,
            email=email,
            student=student,
            relationship=relationship,
            token=token,
            status='pending',
            invited_by=request.user,
            created_at=now,
            updated_at=now,
            expires_at=expires_at
        )

        print(f"\n--- INVITATION EMAIL SENT ---")
        print(f"To: {email}")
        print(f"Subject: Invitation to join KidSynq for {student.first_name} {student.last_name}")
        print(f"Link: http://localhost:5173/family/activate?token={token}")
        print(f"-----------------------------\n")

        serializer = GuardianInvitationSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class DaycareInvitationResendView(APIView):
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        daycare = request.user.daycare
        invitation = GuardianInvitation.objects.filter(id=pk, daycare=daycare).first()
        if not invitation:
            return Response({"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)

        invitation.token = secrets.token_urlsafe(32)
        invitation.expires_at = timezone.now() + timedelta(days=2)
        invitation.status = 'pending'
        invitation.save()

        print(f"\n--- RESENT INVITATION EMAIL ---")
        print(f"To: {invitation.email}")
        print(f"Subject: [Resent] Invitation to join KidSynq for {invitation.student.first_name} {invitation.student.last_name}")
        print(f"Link: http://localhost:5173/family/activate?token={invitation.token}")
        print(f"--------------------------------\n")

        serializer = GuardianInvitationSerializer(invitation)
        return Response(serializer.data)

class DaycareInvitationCancelView(APIView):
    permission_classes = [IsDaycareAdmin]

    def post(self, request, pk):
        daycare = request.user.daycare
        invitation = GuardianInvitation.objects.filter(id=pk, daycare=daycare).first()
        if not invitation:
            return Response({"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)

        invitation.status = 'cancelled'
        invitation.save()

        serializer = GuardianInvitationSerializer(invitation)
        return Response(serializer.data)

class GuardianActivateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        invitation = GuardianInvitation.objects.filter(token=token).first()
        if not invitation:
            return Response({"detail": "Invalid invitation token."}, status=status.HTTP_404_NOT_FOUND)

        if invitation.status == 'cancelled':
            return Response({"detail": "This invitation has been cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.status == 'accepted':
            return Response({"detail": "This invitation has already been accepted."}, status=status.HTTP_400_BAD_REQUEST)
        if invitation.is_expired() or invitation.status == 'expired':
            invitation.status = 'expired'
            invitation.save()
            return Response({"detail": "This invitation link has expired."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "email": invitation.email,
            "relationship": invitation.relationship,
            "student_name": f"{invitation.student.first_name} {invitation.student.last_name}",
            "daycare_name": invitation.daycare.name
        })

    def post(self, request):
        data = request.data
        token = data.get('token')
        password = data.get('password')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        phone = data.get('phone')

        if not token or not password or not first_name or not last_name:
            return Response({"detail": "Missing required fields."}, status=status.HTTP_400_BAD_REQUEST)

        invitation = GuardianInvitation.objects.filter(token=token).first()
        if not invitation:
            return Response({"detail": "Invalid invitation token."}, status=status.HTTP_404_NOT_FOUND)

        if invitation.status != 'pending' or invitation.is_expired():
            return Response({"detail": "This invitation is no longer active."}, status=status.HTTP_400_BAD_REQUEST)

        daycare = invitation.daycare
        email = invitation.email

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_staff": False,
                    "daycare": daycare,
                    "mobile": phone
                }
            )
            user.set_password(password)
            user.save()

            guardian, _ = Guardian.objects.get_or_create(
                user=user,
                defaults={
                    "daycare": daycare,
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "phone": phone
                }
            )

            fc_existing = FamilyChild.objects.filter(student=invitation.student).first()
            if fc_existing:
                family = fc_existing.family
            else:
                from django.utils import timezone
                family = Family.objects.create(created_at=timezone.now(), updated_at=timezone.now(),
                    daycare=daycare,
                    family_name=f"{invitation.student.last_name} Family",
                    primary_contact=f"{first_name} {last_name}",
                    primary_email=email,
                    primary_phone=phone
                )
                FamilyChild.objects.create(family=family, student=invitation.student)

            FamilyGuardian.objects.get_or_create(
                family=family,
                guardian=guardian,
                defaults={
                    "relationship": invitation.relationship,
                    "is_primary": True
                }
            )

            GuardianCommunicationPreference.objects.get_or_create(
                guardian=guardian,
                defaults={
                    "email_alerts": True,
                    "sms_alerts": False,
                    "emergency_alerts_only": False
                }
            )

            invitation.status = 'accepted'
            invitation.save()

        return Response({"detail": "Account activated successfully! You can now log in."}, status=status.HTTP_200_OK)

class GuardianForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user or not hasattr(user, 'guardian_profile'):
            return Response({"detail": "If the email is registered, a password reset link has been sent."}, status=status.HTTP_200_OK)

        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=2)

        GuardianPasswordResetToken.objects.filter(user=user, used=False).update(used=True)

        GuardianPasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )

        print(f"\n--- PASSWORD RESET EMAIL ---")
        print(f"To: {email}")
        print(f"Subject: Reset your KidSynq Guardian Password")
        print(f"Link: http://localhost:5173/family/reset-password?token={token}")
        print(f"-----------------------------\n")

        return Response({"detail": "If the email is registered, a password reset link has been sent."}, status=status.HTTP_200_OK)

class GuardianResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        password = request.data.get('password')

        if not token or not password:
            return Response({"detail": "Token and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        reset_token = GuardianPasswordResetToken.objects.filter(token=token).first()
        if not reset_token or not reset_token.is_valid():
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)

        user = reset_token.user
        user.set_password(password)
        user.save()

        reset_token.used = True
        reset_token.save()

        return Response({"detail": "Password reset successfully. You can now log in."}, status=status.HTTP_200_OK)

class FamilyChildSerializer(serializers.ModelSerializer):
    daycare_name = serializers.CharField(source='daycare.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    current_classroom = serializers.SerializerMethodField(read_only=True)
    enrollment_status = serializers.SerializerMethodField(read_only=True)
    age = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'preferred_name', 'dob', 'age',
            'photo', 'current_classroom', 'enrollment_status', 'daycare_name', 'branch_name'
        ]

    def get_current_classroom(self, obj):
        from .models import ClassroomStudent
        assignment = ClassroomStudent.objects.filter(student=obj, status='Active').first()
        return assignment.classroom.room_name if assignment else None

    def get_enrollment_status(self, obj):
        active_enrollment = obj.enrollments.filter(status='Active').first()
        return active_enrollment.status if active_enrollment else obj.status

    def get_age(self, obj):
        if not obj.dob:
            return 'Unknown'
        from django.utils import timezone
        today = timezone.now().date()
        dob = obj.dob
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        return f"{age} years old"

class FamilyChildrenView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        guardian = request.user.guardian_profile
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        students = Student.objects.filter(id__in=student_ids, deleted_at__isnull=True).order_by('first_name')
        
        serializer = FamilyChildSerializer(students, many=True)
        return Response(serializer.data)

class FamilyChildDetailView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        guardian = request.user.guardian_profile
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        
        # Verify cross-family bounds
        if str(pk) not in [str(sid) for sid in student_ids]:
            return Response({"detail": "You do not have permission to access this student record."}, status=status.HTTP_403_FORBIDDEN)
            
        student = Student.objects.filter(id=pk, deleted_at__isnull=True).first()
        if not student:
            return Response({"detail": "Student record not found."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = FamilyChildSerializer(student)
        return Response(serializer.data)

class FamilyChildAttendanceView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        from .models import FamilyGuardian, FamilyChild, Student, StudentAttendance
        from .serializers import FamilyAttendanceSerializer
        
        guardian = getattr(request.user, 'guardian_profile', None) or getattr(request.user, 'guardian', None)
        if not guardian:
            return Response({"detail": "Guardian profile not found."}, status=status.HTTP_403_FORBIDDEN)
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        
        if str(pk) not in [str(sid) for sid in student_ids]:
            return Response({"detail": "You do not have permission to access this student record."}, status=status.HTTP_403_FORBIDDEN)
            
        student = Student.objects.filter(id=pk, deleted_at__isnull=True).first()
        if not student:
            return Response({"detail": "Student record not found."}, status=status.HTTP_404_NOT_FOUND)
            
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        queryset = StudentAttendance.objects.filter(student=student)
        
        if year and month:
            queryset = queryset.filter(attendance_date__year=year, attendance_date__month=month)
            
        serializer = FamilyAttendanceSerializer(queryset.order_by('-attendance_date'), many=True)
        
        # Calculate summary
        records = serializer.data
        present = sum(1 for r in records if r['attendance_status'] == 'Present')
        absent = sum(1 for r in records if r['attendance_status'] == 'Absent')
        late = sum(1 for r in records if r['attendance_status'] == 'Late')
        sick = sum(1 for r in records if r['attendance_status'] == 'Sick')
        
        return Response({
            'records': records,
            'summary': {
                'present': present,
                'absent': absent,
                'late': late,
                'sick': sick,
                'total': len(records)
            }
        })

class FamilyChildDailyReportsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request, pk):
        from .models import FamilyGuardian, FamilyChild, Student, DailyReport
        from .serializers import DailyReportSerializer
        
        guardian = request.user.guardian_profile
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        
        if str(pk) not in [str(sid) for sid in student_ids]:
            return Response({"detail": "You do not have permission to access this student record."}, status=status.HTTP_403_FORBIDDEN)
            
        student = Student.objects.filter(id=pk, deleted_at__isnull=True).first()
        if not student:
            return Response({"detail": "Student record not found."}, status=status.HTTP_404_NOT_FOUND)
            
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        
        queryset = DailyReport.objects.filter(student=student, status='Completed')
        
        if year and month:
            queryset = queryset.filter(report_date__year=year, report_date__month=month)
            
        serializer = DailyReportSerializer(queryset.order_by('-report_date'), many=True)
        return Response(serializer.data)

class FamilyBillingInvoicesView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        from .models import FamilyGuardian, FamilyChild, Invoice, Payment
        from .serializers import InvoiceSerializer
        from django.db.models import Sum, Q
        import datetime
        
        guardian = request.user.guardian_profile
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        
        status_filter = request.query_params.get('status')
        
        # Get all invoices for these students
        invoices_qs = Invoice.objects.filter(student_id__in=student_ids)
        
        # Calculate summary before filtering by status
        total_outstanding = 0
        unpaid_count = 0
        overdue_count = 0
        
        today = datetime.date.today()
        
        for inv in invoices_qs:
            amount_due = float(inv.total_amount) - float(inv.amount_paid)
            if amount_due > 0 and inv.status not in ['Draft', 'Cancelled']:
                total_outstanding += amount_due
                unpaid_count += 1
                if inv.due_date < today:
                    overdue_count += 1
                    
        # Total paid this month
        payments_qs = Payment.objects.filter(
            student_id__in=student_ids, 
            payment_date__year=today.year, 
            payment_date__month=today.month
        )
        total_paid_this_month = sum(float(p.amount) for p in payments_qs)
        
        # Apply filter for the list
        if status_filter:
            invoices_qs = invoices_qs.filter(status=status_filter)
            
        serializer = InvoiceSerializer(invoices_qs.order_by('-issue_date'), many=True)
        
        # Add student name and amount_due to serialized data to match frontend expectations
        invoices_data = serializer.data
        for item in invoices_data:
            item['student_name'] = item['student_details']['first_name'] + ' ' + item['student_details']['last_name']
            item['amount_due'] = float(item['total_amount']) - float(item['amount_paid'])
            
        return Response({
            'invoices': invoices_data,
            'summary': {
                'total_outstanding': total_outstanding,
                'total_paid_this_month': total_paid_this_month,
                'unpaid_count': unpaid_count,
                'overdue_count': overdue_count
            }
        })

class FamilyBillingPaymentsView(APIView):
    permission_classes = [IsAuthenticatedGuardian]

    def get(self, request):
        from .models import FamilyGuardian, FamilyChild, Payment
        from .serializers import PaymentSerializer
        
        guardian = request.user.guardian_profile
        family_ids = FamilyGuardian.objects.filter(guardian=guardian).values_list('family_id', flat=True)
        student_ids = FamilyChild.objects.filter(family_id__in=family_ids).values_list('student_id', flat=True)
        
        payments_qs = Payment.objects.filter(student_id__in=student_ids).order_by('-payment_date')
        
        serializer = PaymentSerializer(payments_qs, many=True)
        payments_data = serializer.data
        for item in payments_data:
            item['student_name'] = item['student_details']['first_name'] + ' ' + item['student_details']['last_name']
            if item.get('invoice_details'):
                item['invoice_number'] = item['invoice_details']['invoice_number']
            else:
                item['invoice_number'] = 'N/A'
                
        return Response(payments_data)


from rest_framework.permissions import AllowAny
from django.db.models import Q

class PublicDaycareRegistrationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, identifier):
        from .models import Daycare
        import uuid
        
        # Try to match by daycare_code or id
        try:
            uuid_obj = uuid.UUID(identifier)
            daycare = Daycare.objects.filter(Q(id=uuid_obj) | Q(daycare_code=identifier), deleted_at__isnull=True).first()
        except ValueError:
            daycare = Daycare.objects.filter(daycare_code=identifier, deleted_at__isnull=True).first()

        if not daycare:
            return Response({"detail": "Daycare not found."}, status=status.HTTP_404_NOT_FOUND)

        if daycare.status != 'Active':
            return Response({"detail": "Registration is not available for this daycare."}, status=status.HTTP_403_FORBIDDEN)

        # Check if registration is enabled in settings
        # Default to True if no settings exist
        registration_enabled = True
        
        data = {
            "id": str(daycare.id),
            "name": daycare.name,
            "logo": daycare.logo,
            "address": f"{daycare.address1} {daycare.address2 or ''}".strip(),
            "city": daycare.city,
            "state": daycare.state,
            "postal_code": daycare.postal_code,
            "email": daycare.email,
            "phone": daycare.phone,
            "website": daycare.website,
            "registration_enabled": registration_enabled
        }
        
        return Response(data)

import string
import random
from django.utils import timezone

def generate_application_number():
    return 'APP-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

class RegistrationApplicationCreateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        import string
        import random
        from .models import Daycare, RegistrationApplication
        
        def generate_application_number():
            return 'APP-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        daycare_id = request.data.get('daycare_id')
        if not daycare_id:
            return Response({"detail": "Daycare ID is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        import uuid
        daycare = None
        try:
            uuid_obj = uuid.UUID(str(daycare_id))
            daycare = Daycare.objects.filter(Q(id=uuid_obj) | Q(daycare_code=daycare_id), deleted_at__isnull=True).first()
        except (ValueError, TypeError):
            daycare = Daycare.objects.filter(daycare_code=daycare_id, deleted_at__isnull=True).first()

        if not daycare:
            return Response({"detail": "Invalid Daycare ID."}, status=status.HTTP_400_BAD_REQUEST)

        applicant_name = request.data.get('applicant_name', '')
        applicant_email = request.data.get('applicant_email', '')
        applicant_phone = request.data.get('applicant_phone', '')
        
        app_number = generate_application_number()
        import secrets
        access_token = secrets.token_hex(16)
        now = timezone.now()
        
        app = RegistrationApplication.objects.create(
            daycare=daycare,
            application_number=app_number,
            applicant_name=applicant_name,
            applicant_email=applicant_email,
            applicant_phone=applicant_phone,
            status='draft',
            access_token=access_token,
            created_at=now,
            updated_at=now,
            application_data=request.data.get('application_data', {})
        )
        
        return Response({
            "application_number": app.application_number,
            "access_token": str(app.access_token)
        }, status=status.HTTP_201_CREATED)


class RegistrationApplicationDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, application_number):
        from .models import RegistrationApplication
        token = request.query_params.get('token') or request.headers.get('X-Access-Token')
        
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
            
        return Response({
            "application_number": app.application_number,
            "applicant_name": app.applicant_name,
            "applicant_email": app.applicant_email,
            "applicant_phone": app.applicant_phone,
            "status": app.status,
            "application_data": app.application_data,
            "daycare_id": str(app.daycare_id)
        })


class RegistrationApplicationUpdateView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def patch(self, request, application_number):
        from .models import RegistrationApplication
        token = request.data.get('token') or request.headers.get('X-Access-Token')
        
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
            
        if app.status not in ['draft', 'withdrawn']:
            return Response({"detail": "Cannot modify an application that is already submitted."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update fields
        if 'applicant_name' in request.data:
            app.applicant_name = request.data['applicant_name']
        if 'applicant_email' in request.data:
            app.applicant_email = request.data['applicant_email']
        if 'applicant_phone' in request.data:
            app.applicant_phone = request.data['applicant_phone']
        if 'application_data' in request.data:
            app.application_data = request.data['application_data']
            
        app.updated_at = timezone.now()
        app.save()
        
        return Response({"detail": "Application updated."})


class RegistrationApplicationSubmitView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, application_number):
        from .models import RegistrationApplication
        token = request.data.get('token') or request.headers.get('X-Access-Token')
        
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
            
        if app.status != 'draft':
            return Response({"detail": f"Application is already {app.status}."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validate data
        data = app.application_data
        
        # We can implement specific validations here depending on what is required
        child = data.get('child', {})
        first_name = child.get('first_name') or child.get('firstName')
        last_name = child.get('last_name') or child.get('lastName')
        if not first_name or not last_name:
            return Response({"detail": "Child's first and last name are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        app.status = 'submitted'
        app.submitted_at = timezone.now()
        app.save()
        
        return Response({"detail": "Application submitted successfully."})


class AdminRegistrationApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]
    
    def get_queryset(self):
        from .models import RegistrationApplication
        user = self.request.user
        print(f"User: {user.email}, Daycare: {getattr(user, 'daycare', None)}")
        if getattr(user, 'daycare', None):
            qs = RegistrationApplication.objects.filter(daycare=user.daycare).order_by('-created_at')
            print(f"Queryset count: {qs.count()}")
            return qs
        return RegistrationApplication.objects.none()

    def get_serializer_class(self):
        from rest_framework import serializers
        from .models import RegistrationApplication
        


        class RegistrationApplicationSerializer(serializers.ModelSerializer):
            class Meta:
                model = RegistrationApplication
                fields = ['id', 'application_number', 'applicant_name', 'applicant_email', 'applicant_phone', 'status', 'submitted_at', 'created_at', 'application_data']
        return RegistrationApplicationSerializer

    class DuplicateChildException(Exception):
        def __init__(self, student_id):
            self.student_id = student_id
            super().__init__("Duplicate child found")

    class RegistrationApprovalError(Exception):
        def __init__(self, message, status_code):
            self.message = message
            self.status_code = status_code
            super().__init__(message)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        from .models import RegistrationApplication, Family, Student, FamilyChild, ChildEnrollment
        from django.contrib.auth import get_user_model
        from django.db import transaction
        from datetime import date
        from django.utils import timezone
    
        app = self.get_object()
        if app.status == 'approved':
            return Response({"detail": f"Application is already approved."}, status=status.HTTP_400_BAD_REQUEST)
        
        data = app.application_data
    
        try:
            with transaction.atomic():
                from django.db import models
                # 1. Check existing Family
                family_data = data.get('family', {})
                family = Family.objects.filter(
                    daycare=app.daycare
                ).filter(
                    models.Q(primary_email__iexact=app.applicant_email) |
                    models.Q(primary_phone=app.applicant_phone)
                ).first()
            
                if not family:
                    from django.utils import timezone
                family = Family.objects.create(created_at=timezone.now(), updated_at=timezone.now(),
                        daycare=app.daycare,
                        family_name=family_data.get('familyName', app.applicant_name + ' Family'),
                        address=family_data.get('address', ''),
                        primary_contact=app.applicant_name,
                        primary_email=app.applicant_email,
                        primary_phone=app.applicant_phone
                    )
            
                # 2. Check existing Guardian (User)
                User = get_user_model()
                email = app.applicant_email
                if not email:
                    raise RegistrationApprovalError("Applicant email is required for approval.", status.HTTP_400_BAD_REQUEST)
                
                first_name = app.applicant_name.split()[0] if app.applicant_name else 'Guardian'
                last_name = ' '.join(app.applicant_name.split()[1:]) if app.applicant_name and len(app.applicant_name.split()) > 1 else ''
            
                user, created = User.objects.get_or_create(email=email, defaults={
                    'username': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_active': True
                })
            
                if created:
                    user.set_unusable_password()
                    user.save()
            
                # Ensure Guardian profile exists
                from .models import Guardian, FamilyGuardian
                guardian, created = Guardian.objects.get_or_create(user=user, defaults={
                    'created_at': timezone.now(),
                    'updated_at': timezone.now(),
                    'daycare': app.daycare,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': email,
                    'phone': app.applicant_phone
                })
            
                # Link Guardian to Family
                FamilyGuardian.objects.get_or_create(
                    family=family,
                    guardian=guardian,
                    defaults={'relationship': 'Parent', 'is_primary': True, 'created_at': timezone.now()}
                )
            
                # 3. Check existing Child
                student_data = data.get('child', {})
                child_first_name = student_data.get('firstName') or student_data.get('first_name') or 'Unknown'
                child_last_name = student_data.get('lastName') or student_data.get('last_name') or 'Unknown'
                dob = student_data.get('dob')
                gender = student_data.get('gender', 'Other')
            
                existing_student = Student.objects.filter(
                    daycare=app.daycare,
                    first_name__iexact=child_first_name,
                    last_name__iexact=child_last_name,
                    dob=dob if dob else None
                ).first()
            
                if existing_student:
                    if not request.data.get('ignore_duplicate'):
                        # Flag for review, rollback transaction by raising Exception
                        raise self.DuplicateChildException(existing_student.id)
                    student = existing_student
                else:
                    student = Student.objects.create(
                        daycare=app.daycare,
                        first_name=child_first_name,
                        last_name=child_last_name,
                        dob=dob if dob else None,
                        gender=gender
                    )
            
                # Link to family
                FamilyChild.objects.create(created_at=timezone.now(), family=family, student=student)
            
                # 4. Create Enrollment
                req_start_date = data.get('requestedStartDate')
                enrollment_status = 'Pending'
                if req_start_date:
                    try:
                        from datetime import datetime
                        parsed_start = datetime.strptime(req_start_date, '%Y-%m-%d').date()
                        if parsed_start <= date.today():
                            enrollment_status = 'Active'
                    except:
                        pass
            
                enrollment = ChildEnrollment.objects.create(created_at=timezone.now(), updated_at=timezone.now(),
                    student=student,
                    application=app,
                    start_date=req_start_date if req_start_date else None,
                    status=enrollment_status,
                    notes="Created from Registration Application"
                )
            
                app.status = 'approved'
                app.save()
            
                return Response({
                    "detail": "Application approved successfully.", 
                    "child_id": str(student.id), 
                    "family_id": str(family.id),
                    "enrollment_id": str(enrollment.id)
                })
        except self.DuplicateChildException as e:
            return Response({
                "detail": "Possible duplicate child found (matching First Name, Last Name, and DOB). Please review manually.",
                "duplicate_child_id": str(e.student_id)
            }, status=status.HTTP_409_CONFLICT)
        except self.RegistrationApprovalError as e:
            return Response({"detail": str(e.message)}, status=e.status_code)
        except Exception as e:
            return Response({"detail": f"An error occurred during approval: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['post'])
    def waitlist(self, request, pk=None):
        from .models import WaitlistEntry
        app = self.get_object()
        if app.status == 'waitlisted':
            return Response({"detail": f"Application is already waitlisted."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create waitlist entry
        data = app.application_data
        student_data = data.get('child', {})
        from django.utils import timezone
        WaitlistEntry.objects.update_or_create(
            application=app,
            defaults={
                'daycare': app.daycare,
                'child_first_name': student_data.get('firstName') or student_data.get('first_name') or 'Unknown',
                'child_last_name': student_data.get('lastName') or student_data.get('last_name') or 'Unknown',
                'child_dob': student_data.get('dob'),
                'applicant_name': app.applicant_name,
                'applicant_email': app.applicant_email,
                'applicant_phone': app.applicant_phone,
                'status': 'active',
                'priority': 0,
                'waitlist_date': timezone.now(),
                'created_at': timezone.now(),
                'updated_at': timezone.now()
            }
        )
    
        app.status = 'waitlisted'
        app.save()
    
        return Response({"detail": "Application successfully waitlisted."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        app = self.get_object()
        if app.status == 'rejected':
            return Response({"detail": f"Application is already rejected."}, status=status.HTTP_400_BAD_REQUEST)
        
        app.status = 'rejected'
        app.save()
    
        return Response({"detail": "Application rejected."})


class EnrollmentFormViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsDaycareAdmin]

    def get_queryset(self):
        from .models import EnrollmentForm
        user = self.request.user
        if getattr(user, 'daycare', None):
            return EnrollmentForm.objects.filter(daycare=user.daycare)
        return EnrollmentForm.objects.none()

    def get_serializer_class(self):
        from rest_framework import serializers
        from .models import EnrollmentForm
    
        class EnrollmentFormSerializer(serializers.ModelSerializer):
            class Meta:
                model = EnrollmentForm
                fields = ['id', 'title', 'description', 'version', 'is_required', 'is_active', 'fields_schema', 'created_at']
        return EnrollmentFormSerializer

    def perform_create(self, serializer):
        from django.utils import timezone
        now = timezone.now()
        serializer.save(
            daycare=self.request.user.daycare,
            created_at=now,
            updated_at=now,
            waitlist_date=now
        )

class PublicEnrollmentFormView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, identifier):
        from .models import Daycare, EnrollmentForm
        from django.db.models import Q
        try:
            daycare = Daycare.objects.get(Q(id=identifier) | Q(daycare_code=identifier))
        except (Daycare.DoesNotExist, ValueError):
            return Response({"detail": "Daycare not found."}, status=status.HTTP_404_NOT_FOUND)
        
        forms = EnrollmentForm.objects.filter(daycare=daycare, is_active=True).values(
            'id', 'title', 'description', 'version', 'is_required', 'fields_schema'
        )
        return Response(list(forms))

class DocumentUploadView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, application_number):
        from .models import RegistrationApplication, Document
        from django.contrib.contenttypes.models import ContentType
        token = request.data.get('token')
    
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
        
        file_obj = request.FILES.get('file')
        doc_type = request.data.get('document_type', 'Other')
    
        if not file_obj:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
        
        content_type = ContentType.objects.get_for_model(RegistrationApplication)
        
        doc = Document.objects.create(
            daycare=app.daycare,
            title=doc_type,
            file_path=file_obj,
            status='uploaded',
            content_type=content_type,
            object_id=app.id
        )
    
        return Response({
            "id": str(doc.id),
            "document_type": doc.title,
            "status": doc.status,
            "uploaded_date": doc.created_at
        })

    def get(self, request, application_number):
        from .models import RegistrationApplication, Document
        from django.contrib.contenttypes.models import ContentType
        token = request.query_params.get('token')
    
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
        
        content_type = ContentType.objects.get_for_model(RegistrationApplication)
        docs = Document.objects.filter(content_type=content_type, object_id=app.id).values(
            'id', 'title', 'status', 'created_at'
        )
    
        # Format the response to match what frontend expects
        formatted_docs = [
            {
                'id': d['id'],
                'document_type': d['title'],
                'status': d['status'],
                'uploaded_date': d['created_at']
            } for d in docs
        ]
    
        return Response(formatted_docs)

class ApplicationConsentView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, application_number):
        from .models import RegistrationApplication, ConsentForm
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # For public consent view, we just return the active consent forms of the daycare
        forms = ConsentForm.objects.filter(daycare=app.daycare, status='Active').values(
            'id', 'title', 'description', 'content', 'requires_signature', 'version'
        )
        return Response(list(forms))

class SecureFileDownloadView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, document_id):
        from .models import Document, RegistrationApplication
        from django.contrib.contenttypes.models import ContentType
        from django.http import HttpResponse, Http404
    
        token = request.query_params.get('token')
    
        try:
            doc = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            raise Http404("Document not found")
        
        is_authorized = False
        app = None
    
        app_content_type = ContentType.objects.get_for_model(RegistrationApplication)
        if doc.content_type == app_content_type:
            app = RegistrationApplication.objects.get(id=doc.object_id)
    
        # 1. Admin check
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            from rest_framework_simplejwt.tokens import AccessToken
            from core.models import User
            try:
                jwt_token = AccessToken(auth_header.split(' ')[1])
                user_id = jwt_token['user_id']
                user = User.objects.get(id=user_id)
                if getattr(user, 'daycare', None) == doc.daycare:
                    is_authorized = True
            except Exception:
                pass
            
        # 2. Public token check
        if app and str(app.access_token) == token:
            is_authorized = True
        
        if not is_authorized:
            return Response({"detail": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        
        if not doc.file_path:
            raise Http404("File not found")
        
        import mimetypes
        import os
    
        file_path = doc.file_path.path
        if os.path.exists(file_path):
            with open(file_path, 'rb') as fh:
                response = HttpResponse(fh.read(), content_type=mimetypes.guess_type(file_path)[0] or 'application/octet-stream')
                response['Content-Disposition'] = 'inline; filename=' + os.path.basename(file_path)
                return response
        raise Http404("File not found on disk")

    def post(self, request, application_number):
        from .models import RegistrationApplication, ConsentForm
        from django.utils import timezone
    
        token = request.data.get('token')
        form_id = request.data.get('form_id')
        signature_name = request.data.get('signature_name')
    
        try:
            app = RegistrationApplication.objects.get(application_number=application_number)
        except RegistrationApplication.DoesNotExist:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if str(app.access_token) != token:
            return Response({"detail": "Invalid access token."}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            form = ConsentForm.objects.get(id=form_id)
        except ConsentForm.DoesNotExist:
            return Response({"detail": "Consent form not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if not signature_name:
            return Response({"detail": "Signature name is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        app_data = app.application_data or {}
        consents = app_data.get('consents', [])
    
        # Remove existing if already signed (allow re-signing)
        consents = [c for c in consents if c.get('form_id') != str(form.id)]
    
        consents.append({
            'form_id': str(form.id),
            'title': form.title,
            'version': form.version,
            'signature_name': signature_name,
            'signed_at': timezone.now().isoformat()
        })
    
        app_data['consents'] = consents
        app.application_data = app_data
        app.save()
    
        return Response({"detail": "Consent recorded successfully."})


class WaitlistViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .models import WaitlistEntry
        user = self.request.user
        if not getattr(user, 'daycare', None):
            return WaitlistEntry.objects.none()
        
        queryset = WaitlistEntry.objects.filter(daycare=user.daycare)
    
        status = self.request.query_params.get('status')
        if status and status != 'all':
            queryset = queryset.filter(status=status)
        
        return queryset

    def get_serializer_class(self):
        from rest_framework import serializers
        from .models import WaitlistEntry
    
        class WaitlistEntrySerializer(serializers.ModelSerializer):
            position = serializers.SerializerMethodField()
        
            class Meta:
                model = WaitlistEntry
                fields = '__all__'
                read_only_fields = ('daycare', 'created_at', 'updated_at')
            
            def get_position(self, obj):
                # Count how many entries have higher priority OR (same priority but older waitlist_date)
                # among 'active' or 'contacted' waitlist entries
                if obj.status not in ['active', 'contacted']:
                    return None
                
                higher_priority_count = WaitlistEntry.objects.filter(
                    daycare=obj.daycare,
                    status__in=['active', 'contacted'],
                    priority__gt=obj.priority
                ).count()
            
                same_priority_older_count = WaitlistEntry.objects.filter(
                    daycare=obj.daycare,
                    status__in=['active', 'contacted'],
                    priority=obj.priority,
                    waitlist_date__lt=obj.waitlist_date
                ).count()
            
                return higher_priority_count + same_priority_older_count + 1

        return WaitlistEntrySerializer

    def perform_create(self, serializer):
        serializer.save(daycare=self.request.user.daycare)

    @action(detail=True, methods=['post'])
    def contact(self, request, pk=None):
        entry = self.get_object()
        entry.status = 'contacted'
        entry.save()
        return Response({'status': 'contacted'})

    @action(detail=True, methods=['post'])
    def offer(self, request, pk=None):
        entry = self.get_object()
        entry.status = 'offered'
        entry.save()
        return Response({'status': 'offered'})

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        entry = self.get_object()
    
        # If no application exists, create one
        if not entry.application:
            app = RegistrationApplication.objects.create(
                daycare=entry.daycare,
                applicant_name=entry.applicant_name,
                applicant_email=entry.applicant_email,
                applicant_phone=entry.applicant_phone,
                status='submitted',
                application_data={
                    "child": {
                        "firstName": entry.child_first_name,
                        "lastName": entry.child_last_name,
                        "dob": entry.child_dob.isoformat() if entry.child_dob else None
                    },
                    "preferences": {
                        "startDate": entry.requested_start_date.isoformat() if entry.requested_start_date else None,
                        "program": entry.preferred_program,
                        "location": entry.preferred_branch
                    }
                }
            )
            entry.application = app
        else:
            entry.application.status = 'submitted'
            entry.application.save()
        
        entry.status = 'converted'
        entry.save()
    
        return Response({'status': 'converted', 'application_id': entry.application.id})

