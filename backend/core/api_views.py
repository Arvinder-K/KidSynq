from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import User
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

from .models import Student
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

class ClassroomAssignTeacherView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        daycare = request.user.daycare
        try:
            classroom = Classroom.objects.get(pk=pk, daycare=daycare, deleted_at__isnull=True)
            teacher_id = request.data.get('teacher_id')
            role = request.data.get('role', 'primary') # 'primary' or 'assistant'
            
            if not teacher_id:
                return Response({"detail": "Teacher ID is required."}, status=status.HTTP_400_BAD_REQUEST)
                
            from .models import Employee
            teacher = Employee.objects.get(pk=teacher_id, daycare=daycare)
            
            if role == 'primary':
                classroom.primary_teacher = teacher.user
            else:
                classroom.assistant_teacher = teacher.user
            classroom.save()
            
            return Response({"detail": f"Teacher assigned as {role} successfully."})
        except Classroom.DoesNotExist:
            return Response({"detail": "Classroom not found."}, status=status.HTTP_404_NOT_FOUND)
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
        plans = SubscriptionPlan.objects.all().order_by('price')
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
