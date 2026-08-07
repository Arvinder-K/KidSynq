from rest_framework import serializers
from .models import User, Employee

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'daycare', 'role', 'is_superuser']
        depth = 1
        
    def get_role(self, obj):
        if obj.is_superuser:
            return 'Platform Admin'
        return 'Daycare Admin'

class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Employee
        fields = ['id', 'user', 'role', 'employee_number', 'employment_type', 'hire_date']

from .models import Student

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = '__all__'

from .models import Document, DocumentFolder

class DocumentFolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentFolder
        fields = '__all__'

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = '__all__'

from .models import IncidentReport, InspectionVisit

class IncidentReportSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    
    class Meta:
        model = IncidentReport
        fields = '__all__'
        
    def get_student_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return "N/A"

class InspectionVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionVisit
        fields = '__all__'

from .models import Program, Classroom

class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'

class ClassroomSerializer(serializers.ModelSerializer):
    program_name = serializers.SerializerMethodField()
    primary_teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = '__all__'

    def get_program_name(self, obj):
        return obj.program.name if obj.program else "Unassigned"

    def get_primary_teacher_name(self, obj):
        if obj.primary_teacher:
            return f"{obj.primary_teacher.first_name} {obj.primary_teacher.last_name}"
        return "None"

from .models import StudentAttendance

class StudentAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAttendance
        fields = '__all__'

class AttendanceRosterSerializer(serializers.ModelSerializer):
    attendance_status = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = ['id', 'first_name', 'last_name', 'attendance_status']
        
    def get_attendance_status(self, obj):
        # We'll attach the today_attendance object to the student in the view
        if hasattr(obj, 'today_attendance') and obj.today_attendance:
            return obj.today_attendance.attendance_status
        return "Unmarked"

from .models import DailyReport, MealRecord, NapRecord, ActivityRecord

class MealRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealRecord
        fields = '__all__'

class NapRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = NapRecord
        fields = '__all__'

class ActivityRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityRecord
        fields = '__all__'

class DailyReportSerializer(serializers.ModelSerializer):
    meals = MealRecordSerializer(many=True, read_only=True)
    naps = NapRecordSerializer(many=True, read_only=True)
    activities = ActivityRecordSerializer(many=True, read_only=True)

    class Meta:
        model = DailyReport
        fields = '__all__'

from .models import HealthProfile, Allergy, Medication, MedicationAdministration

class HealthProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthProfile
        fields = '__all__'

class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = '__all__'

class MedicationAdministrationSerializer(serializers.ModelSerializer):
    administered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicationAdministration
        fields = '__all__'

    def get_administered_by_name(self, obj):
        if obj.administered_by:
            return f"{obj.administered_by.first_name} {obj.administered_by.last_name}"
        return "Unknown"

class MedicationSerializer(serializers.ModelSerializer):
    administrations = MedicationAdministrationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Medication
        fields = '__all__'

class StudentHealthDashboardSerializer(serializers.ModelSerializer):
    allergy_count = serializers.SerializerMethodField()
    medication_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = ['id', 'first_name', 'last_name', 'allergy_count', 'medication_count']
        
    def get_allergy_count(self, obj):
        return obj.allergy_records.count()
        
    def get_medication_count(self, obj):
        return obj.medication_records.filter(is_active=True).count()

class StudentHealthDetailSerializer(serializers.ModelSerializer):
    health_profile = serializers.SerializerMethodField()
    allergies = serializers.SerializerMethodField()
    active_medications = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = ['id', 'first_name', 'last_name', 'date_of_birth', 'health_profile', 'allergies', 'active_medications']
        
    def get_health_profile(self, obj):
        try:
            profile = HealthProfile.objects.get(student=obj)
            return HealthProfileSerializer(profile).data
        except HealthProfile.DoesNotExist:
            return None
            
    def get_allergies(self, obj):
        allergies = obj.allergy_records.all()
        return AllergySerializer(allergies, many=True).data
        
    def get_active_medications(self, obj):
        meds = obj.medication_records.filter(is_active=True).prefetch_related('administrations')
        return MedicationSerializer(meds, many=True).data

from .models import Invoice, InvoiceItem, Payment, SubscriptionPlan, DaycareSubscription

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        
    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else "Unknown"

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class DaycareSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DaycareSubscription
        fields = '__all__'
        
    def get_plan_name(self, obj):
        return obj.subscription_plan.name if obj.subscription_plan else "None"
        
    def create(self, validated_data):
        subscription = super().create(validated_data)
        if subscription.daycare:
            subscription.daycare.status = 'Active'
            subscription.daycare.save()
        return subscription
        
    def update(self, instance, validated_data):
        subscription = super().update(instance, validated_data)
        if subscription.daycare:
            subscription.daycare.status = 'Active'
            subscription.daycare.save()
        return subscription

from .models import Announcement
from django.contrib.auth import get_user_model
User = get_user_model()

class AnnouncementSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Announcement
        fields = ['id', 'title', 'content', 'type', 'status', 'published_at', 'sender_name']
        
    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}" if obj.sender else "Unknown"

class UserProfileSerializer(serializers.ModelSerializer):
    daycare_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'phone', 'role', 'daycare_name', 'is_superuser']
        read_only_fields = ['id', 'email', 'role', 'daycare_name', 'is_superuser']
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else None

from .models import Daycare
class AdminDaycareSerializer(serializers.ModelSerializer):
    class Meta:
        model = Daycare
        fields = '__all__'

class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'daycare', 'is_staff', 'is_superuser']
        
    def get_role(self, obj):
        if obj.is_superuser:
            return 'Platform Admin'
        return 'Daycare Admin'
        
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

from .models import AgeGroup

class AgeGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgeGroup
        fields = '__all__'
        read_only_fields = ['daycare', 'created_by', 'updated_by']

    def validate(self, data):
        min_age = data.get('min_age_months', self.instance.min_age_months if self.instance else None)
        max_age = data.get('max_age_months', self.instance.max_age_months if self.instance else None)
        name = data.get('name', self.instance.name if self.instance else None)

        if min_age is None or max_age is None:
            raise serializers.ValidationError("min_age_months and max_age_months are required.")

        if max_age <= min_age:
            raise serializers.ValidationError({"max_age_months": "Maximum age must be greater than minimum age."})

        daycare = self.context['request'].user.daycare
        queryset = AgeGroup.objects.filter(daycare=daycare, deleted_at__isnull=True)
        
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.filter(name__iexact=name).exists():
            raise serializers.ValidationError({"name": "An age group with this name already exists in this daycare."})

        overlaps = queryset.filter(
            min_age_months__lte=max_age,
            max_age_months__gte=min_age
        )
        if overlaps.exists():
            overlapping_names = ", ".join([og.name for og in overlaps])
            raise serializers.ValidationError(f"Age range overlaps with existing groups: {overlapping_names}")

        return data

from .models import ClassroomTeacherAssignment, Employee

class AvailableTeacherSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = ['id', 'name', 'employee_number', 'email', 'role']
        
    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
        
    def get_email(self, obj):
        return obj.email or (obj.user.email if obj.user else None)

class ClassroomTeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher = AvailableTeacherSerializer(source='employee', read_only=True)
    
    class Meta:
        model = ClassroomTeacherAssignment
        fields = '__all__'
        read_only_fields = ['daycare', 'created_by', 'updated_by', 'assigned_date']
