from datetime import datetime, date
from django.db.models import Q
from rest_framework import serializers
from .models import (
    User, Employee, EmployeeType, EmployeeQualification, EmployeeCertification,
    EmploymentHistory, EmployeeCompensation, EmployeeDocument,
    EmployeeEmergencyContact, EmployeeAvailability, ClassroomTeacherAssignment,
    Province, CredentialType, ECECredential, StaffSchedule, ShiftBreak,
    OvertimeRecord, TimeBankRule, TimeBankTransaction, ShiftSwapRequest,
    LeaveType, LeaveRequest, StaffShortageAlert, StaffNotification
)







class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'daycare', 'role', 'is_superuser']
        depth = 1
        
    def get_role(self, obj):
        if obj.is_superuser:
            return 'Platform Admin'
        if hasattr(obj, 'guardian_profile'):
            return 'Guardian'
        return 'Daycare Admin'

class EmployeeTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeType
        fields = ['id', 'name', 'daycare', 'is_eligible_for_classroom', 'created_at']
        read_only_fields = ['created_at']

class EmployeeQualificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeQualification
        fields = ['id', 'employee', 'qualification_name', 'institution', 'qualification_type', 'issue_date', 'completion_date', 'expiry_date', 'document_reference', 'status', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class EmployeeCertificationSerializer(serializers.ModelSerializer):
    status = serializers.ReadOnlyField()
    
    class Meta:
        model = EmployeeCertification
        fields = ['id', 'employee', 'certification_name', 'certification_number', 'issuing_organization', 'issue_date', 'expiry_date', 'document_reference', 'notes', 'status', 'created_at', 'updated_at']
        read_only_fields = ['status', 'created_at', 'updated_at']

class EmployeeEmergencyContactSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), required=False)

    class Meta:
        model = EmployeeEmergencyContact
        fields = ['id', 'employee', 'name', 'relationship', 'phone', 'email', 'is_primary', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class EmployeeAvailabilitySerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), required=False)
    available_from = serializers.TimeField(source='start_time', required=False, allow_null=True)
    available_to = serializers.TimeField(source='end_time', required=False, allow_null=True)

    class Meta:
        model = EmployeeAvailability
        fields = [
            'id', 'employee', 'day_of_week', 'start_time', 'end_time',
            'available_from', 'available_to', 'is_available', 'status',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        if 'start_time' not in attrs and 'available_from' in attrs:
            attrs['start_time'] = attrs['available_from']
        if 'end_time' not in attrs and 'available_to' in attrs:
            attrs['end_time'] = attrs['available_to']

        is_avail = attrs.get('is_available', True)
        status_val = attrs.get('status')
        if not is_avail or status_val == 'Unavailable':
            attrs['status'] = 'Unavailable'
            attrs['is_available'] = False
        elif status_val == 'Custom hours' or (attrs.get('start_time') and attrs.get('end_time')):
            attrs['status'] = 'Custom hours'
            attrs['is_available'] = True
        elif not status_val:
            attrs['status'] = 'Available'
            attrs['is_available'] = True

        return attrs

class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ['id', 'code', 'name', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class CredentialTypeSerializer(serializers.ModelSerializer):
    province_code = serializers.CharField(source='province.code', read_only=True)
    province_name = serializers.CharField(source='province.name', read_only=True)

    class Meta:
        model = CredentialType
        fields = [
            'id', 'name', 'category', 'description', 'province', 'province_code', 'province_name',
            'status', 'requires_expiry', 'requires_certificate_number', 'default_validity_months',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ECECredentialSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), required=False)
    credential_type_detail = CredentialTypeSerializer(source='credential_type', read_only=True)
    province_detail = ProvinceSerializer(source='province', read_only=True)
    employee_name = serializers.SerializerMethodField()
    category = serializers.CharField(source='credential_type.category', read_only=True)
    is_expired = serializers.ReadOnlyField()
    issue_date = serializers.DateField(required=False)
    document = serializers.FileField(required=False, allow_null=True)
    document_url = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ECECredential
        fields = [
            'id', 'employee', 'employee_name', 'daycare',
            'credential_type', 'credential_type_detail', 'category',
            'certificate_number', 'issuing_organization',
            'province', 'province_detail',
            'request_date', 'completed_date',
            'issue_date', 'expiry_date', 'renewal_date',
            'document', 'document_url', 'document_reference', 'document_status',
            'status', 'verification_status',
            'verified_by', 'verified_by_name', 'verified_at', 'rejection_reason',
            'previous_credential', 'is_current', 'notes',
            'is_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'daycare', 'is_expired', 'category', 'document_url', 'document_status',
            'verified_by', 'verified_by_name', 'verified_at', 'rejection_reason',
            'previous_credential', 'is_current', 'created_at', 'updated_at'
        ]

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def get_document_url(self, obj):
        if obj.document:
            return f"/api/daycare/credentials/{obj.id}/document/"
        return obj.document_reference or None

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            name = f"{obj.verified_by.first_name} {obj.verified_by.last_name}".strip()
            return name if name else obj.verified_by.username
        return None

    def validate(self, data):
        issue_date = data.get('issue_date') or (self.instance.issue_date if self.instance else None)
        expiry_date = data.get('expiry_date') if 'expiry_date' in data else (self.instance.expiry_date if self.instance else None)
        renewal_date = data.get('renewal_date') if 'renewal_date' in data else (self.instance.renewal_date if self.instance else None)
        request_date = data.get('request_date') if 'request_date' in data else (self.instance.request_date if self.instance else None)
        completed_date = data.get('completed_date') if 'completed_date' in data else (self.instance.completed_date if self.instance else None)
        credential_type = data.get('credential_type') or (self.instance.credential_type if self.instance else None)
        certificate_number = data.get('certificate_number') if 'certificate_number' in data else (self.instance.certificate_number if self.instance else None)
        province = data.get('province') or (self.instance.province if self.instance else None)

        if request_date and completed_date and completed_date < request_date:
            raise serializers.ValidationError({"completed_date": "Completion date cannot be before request date."})

        # If issue_date not provided but completed_date is provided (common for background checks), set issue_date to completed_date
        if not issue_date and completed_date:
            data['issue_date'] = completed_date
            issue_date = completed_date

        if not issue_date and not completed_date:
            raise serializers.ValidationError({"issue_date": "Issue date is required."})

        if expiry_date and issue_date and expiry_date < issue_date:
            raise serializers.ValidationError({"expiry_date": "Expiry date cannot be before the issue date."})

        if renewal_date and expiry_date and renewal_date > expiry_date:
            raise serializers.ValidationError({"renewal_date": "Renewal date should not be after the expiry date."})

        if credential_type:
            if credential_type.requires_certificate_number and not certificate_number:
                raise serializers.ValidationError({"certificate_number": f"{credential_type.name} requires a certificate number."})
            if credential_type.requires_expiry and not expiry_date:
                raise serializers.ValidationError({"expiry_date": f"{credential_type.name} requires an expiry date."})

        # Check for duplicate certificate number within the same province & credential type if certificate_number provided
        if certificate_number and credential_type:
            cert_num_clean = certificate_number.strip()
            existing_qs = ECECredential.objects.filter(
                credential_type=credential_type,
                certificate_number__iexact=cert_num_clean,
                is_current=True
            )
            if province:
                existing_qs = existing_qs.filter(province=province)
            if self.instance:
                existing_qs = existing_qs.exclude(id=self.instance.id)
            if existing_qs.exists():
                prov_label = f" in {province.name}" if province else ""
                raise serializers.ValidationError({
                    "certificate_number": f"A credential with certificate number '{cert_num_clean}' already exists{prov_label}."
                })

        return data


class CredentialRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(required=True, min_length=3)


class CredentialRenewalSerializer(serializers.Serializer):
    issue_date = serializers.DateField(required=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    renewal_date = serializers.DateField(required=False, allow_null=True)
    certificate_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    issuing_organization = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    document = serializers.FileField(required=False, allow_null=True)
    document_reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, data):
        issue_date = data.get('issue_date')
        expiry_date = data.get('expiry_date')
        renewal_date = data.get('renewal_date')

        if expiry_date and issue_date and expiry_date < issue_date:
            raise serializers.ValidationError({"expiry_date": "Expiry date cannot be before the issue date."})
        if renewal_date and expiry_date and renewal_date > expiry_date:
            raise serializers.ValidationError({"renewal_date": "Renewal date should not be after the expiry date."})
        return data




class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    types = serializers.PrimaryKeyRelatedField(many=True, queryset=EmployeeType.objects.all(), required=False)
    types_detail = EmployeeTypeSerializer(source='types', many=True, read_only=True)
    is_eligible_for_classroom = serializers.SerializerMethodField()
    current_classrooms = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = [
            'id', 'daycare', 'user', 'first_name', 'last_name', 'preferred_name',
            'email', 'phone', 'employee_number', 'role', 'job_title',
            'employment_type', 'date_of_birth', 'start_date', 'end_date',
            'status', 'photo', 'sin', 'types', 'types_detail',
            'is_eligible_for_classroom', 'current_classrooms', 'created_at', 'updated_at'
        ]
        read_only_fields = ['daycare', 'created_at', 'updated_at']

    def get_is_eligible_for_classroom(self, obj):
        return obj.is_eligible_for_classroom()

    def get_current_classrooms(self, obj):
        assignments = obj.classroom_assignments.filter(status='Active', deleted_at__isnull=True).select_related('classroom')
        return [
            {
                'assignment_id': str(a.id),
                'classroom_id': str(a.classroom.id),
                'classroom_name': a.classroom.room_name,
                'classroom_code': a.classroom.room_code,
                'assignment_type': a.assignment_type,
                'assigned_date': a.assigned_date
            }
            for a in assignments
        ]

    def validate(self, attrs):
        request = self.context.get('request')
        daycare = request.user.daycare if request and hasattr(request.user, 'daycare') else None
        
        employee_number = attrs.get('employee_number')
        status = attrs.get('status', 'active')
        
        # Unique active employee number per daycare
        if daycare and employee_number and status == 'active':
            qs = Employee.objects.filter(daycare=daycare, employee_number=employee_number, status='active')
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({"employee_number": "An active employee with this number already exists in your daycare."})
                
        # Validate dates
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})
            
        return attrs

from .models import Student, ChildEnrollment

class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = '__all__'
        read_only_fields = ['daycare', 'branch']

class ChildEnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChildEnrollment
        fields = '__all__'
        read_only_fields = ['student', 'created_at', 'updated_at']

class ChildListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            'id', 'daycare_id', 'admission_number', 'first_name', 'last_name', 
            'preferred_name', 'dob', 'gender', 'photo', 'admission_date', 
            'joining_date', 'status', 'created_at', 'updated_at'
        ]

class ChildDetailSerializer(serializers.ModelSerializer):
    current_classroom = serializers.SerializerMethodField()
    enrollment_status = serializers.SerializerMethodField()
    medical_alerts = serializers.SerializerMethodField()
    primary_emergency_contact = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'daycare', 'branch', 'admission_number', 'first_name', 'last_name', 
            'preferred_name', 'dob', 'gender', 'language', 'admission_date', 'joining_date', 
            'photo', 'status', 'child_notes', 'administrative_notes', 'allergies', 
            'medical_conditions', 'medication', 'special_needs', 'dietary_restrictions', 
            'doctor_name', 'doctor_phone', 'medical_notes', 'hospital_name', 'created_at', 
            'updated_at', 'current_classroom', 'enrollment_status', 'medical_alerts', 
            'primary_emergency_contact'
        ]
        read_only_fields = ['daycare', 'branch']

    def get_current_classroom(self, obj):
        from .models import ClassroomStudent
        assignment = ClassroomStudent.objects.filter(student=obj, status='Active').first()
        return assignment.classroom.room_name if assignment else None

    def get_enrollment_status(self, obj):
        active_enrollment = obj.childenrollment_set.filter(status='Active').first()
        return active_enrollment.status if active_enrollment else obj.status

    def get_medical_alerts(self, obj):
        alerts = []
        if obj.allergies:
            alerts.append(f"Allergy: {obj.allergies}")
        if obj.medical_conditions:
            alerts.append(f"Condition: {obj.medical_conditions}")
        return alerts

    def get_primary_emergency_contact(self, obj):
        contact = obj.emergency_contacts.filter(is_primary=True).first()
        if contact:
            return f"{contact.name} ({contact.relationship}) - {contact.mobile}"
        return None

from .models import StudentEmergencyContact, StudentPickup

class StudentEmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentEmergencyContact
        fields = '__all__'
        read_only_fields = ['student']

class StudentPickupSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_effective = serializers.BooleanField(read_only=True)
    photo_url = serializers.SerializerMethodField()
    child_name = serializers.SerializerMethodField()
    person_name = serializers.CharField(source='name', required=False)
    relationship_to_child = serializers.CharField(source='relationship', required=False)

    class Meta:
        model = StudentPickup
        fields = [
            'id', 'daycare', 'student', 'family', 'name', 'person_name',
            'relationship', 'relationship_to_child', 'phone', 'email',
            'photo', 'photo_url', 'authorization_status', 'valid_from',
            'valid_until', 'notes', 'status', 'approval_status',
            'id_proof_status', 'pending_changes', 'is_expired',
            'is_effective', 'child_name', 'created_by', 'updated_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'student', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_photo_url(self, obj):
        if obj.photo:
            try:
                return obj.photo.url
            except Exception:
                return f"/api/daycare/authorized-pickups/{obj.id}/photo/"
        return None


    def get_child_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return None

AuthorizedPickupSerializer = StudentPickupSerializer


class PickupVerificationRequestSerializer(serializers.Serializer):
    child_id = serializers.UUIDField(required=True)
    pickup_person_id = serializers.UUIDField(required=True)
    verification_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


from .models import PickupQRToken, PickupSecurityPIN, SafeArrivalDepartureEvent


class PickupQRTokenSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)
    pickup_person_name = serializers.CharField(source='pickup_person.name', read_only=True)
    pickup_person_phone = serializers.CharField(source='pickup_person.phone', read_only=True)

    class Meta:
        model = PickupQRToken
        fields = [
            'id', 'daycare', 'pickup_person', 'pickup_person_name', 'pickup_person_phone',
            'token', 'is_active', 'expires_at', 'revoked_at', 'revoked_by',
            'created_at', 'is_valid'
        ]
        read_only_fields = ['id', 'token', 'daycare', 'created_at', 'revoked_at', 'revoked_by']


class PickupSecurityPINSetSerializer(serializers.Serializer):
    pickup_person_id = serializers.UUIDField(required=True)
    pin = serializers.CharField(required=True, min_length=4, max_length=6)

    def validate_pin(self, value):
        if not value.isdigit():
            raise serializers.ValidationError("PIN must contain only numeric digits.")
        return value


class PickupSecurityPINVerifySerializer(serializers.Serializer):
    pickup_person_id = serializers.UUIDField(required=True)
    pin = serializers.CharField(required=True, min_length=4, max_length=6)


class QRScanRequestSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)


class QRCheckInSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    child_id = serializers.UUIDField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class QRCheckOutSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    child_id = serializers.UUIDField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class PINCheckOutSerializer(serializers.Serializer):
    pickup_person_id = serializers.UUIDField(required=True)
    pin = serializers.CharField(required=True, min_length=4, max_length=6)
    child_id = serializers.UUIDField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class DigitalSignatureCheckOutSerializer(serializers.Serializer):
    pickup_person_id = serializers.UUIDField(required=True)
    child_id = serializers.UUIDField(required=True)
    signature_data = serializers.CharField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class SafeArrivalDepartureEventSerializer(serializers.ModelSerializer):
    child_name = serializers.SerializerMethodField()
    pickup_person_name = serializers.SerializerMethodField()
    processed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SafeArrivalDepartureEvent
        fields = [
            'id', 'daycare', 'student', 'child_name', 'authorized_pickup',
            'pickup_person_name', 'attendance_record', 'event_type',
            'verification_method', 'verification_status', 'failure_reason',
            'is_late_pickup', 'expected_pickup_time', 'actual_checkout_time',
            'late_duration_minutes', 'attempted_person_name',
            'timestamp', 'processed_by', 'processed_by_name', 'signature_data',
            'notes', 'device_metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_child_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return None

    def get_pickup_person_name(self, obj):
        if obj.authorized_pickup:
            return obj.authorized_pickup.name
        if obj.attempted_person_name:
            return obj.attempted_person_name
        return None

    def get_processed_by_name(self, obj):
        if obj.processed_by:
            name = f"{obj.processed_by.first_name} {obj.processed_by.last_name}".strip()
            return name or obj.processed_by.username
        return None



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
    age_group_name = serializers.CharField(source='age_group.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = Classroom
        fields = '__all__'
        read_only_fields = ['daycare', 'created_at', 'updated_at', 'deleted_at']

    def get_program_name(self, obj):
        return obj.program.name if obj.program else "Unassigned"

    def get_primary_teacher_name(self, obj):
        if obj.primary_teacher:
            return f"{obj.primary_teacher.first_name} {obj.primary_teacher.last_name}"
        return "None"

    def validate_capacity(self, value):
        if value is not None and value <= 0:
            from rest_framework import serializers
            raise serializers.ValidationError("Capacity must be greater than zero.")
        return value

    def validate(self, data):
        daycare = None
        if self.instance:
            daycare = self.instance.daycare
        else:
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                daycare = request.user.daycare

        branch = data.get('branch', getattr(self.instance, 'branch', None))
        if branch and daycare and branch.daycare != daycare:
            from rest_framework import serializers
            raise serializers.ValidationError({'branch': 'Branch must belong to the same daycare.'})
            
        age_group = data.get('age_group', getattr(self.instance, 'age_group', None))
        if age_group and daycare and age_group.daycare != daycare:
            from rest_framework import serializers
            raise serializers.ValidationError({'age_group': 'Age group must belong to the same daycare.'})
            
        return data

from .models import ClassroomTeacherAssignment

class ClassroomTeacherAssignmentSerializer(serializers.ModelSerializer):
    employee_details = EmployeeSerializer(source='employee', read_only=True)
    
    class Meta:
        model = ClassroomTeacherAssignment
        fields = '__all__'
        read_only_fields = ['daycare', 'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at']

from .models import StudentAttendance, AuditLog

class AttendanceAuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'user_type', 'action',
            'module', 'entity_type', 'entity_id', 'old_values',
            'new_values', 'ip_address', 'created_at'
        ]

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name if name else obj.user.username
        return 'System'


class StudentAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_admission_number = serializers.SerializerMethodField()
    student_photo = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    received_by_name = serializers.SerializerMethodField()
    released_by_name = serializers.SerializerMethodField()
    pickup_person_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    corrected_by_name = serializers.SerializerMethodField()
    supporting_document_title = serializers.SerializerMethodField()

    class Meta:
        model = StudentAttendance
        fields = [
            'id', 'daycare', 'branch', 'student', 'enrollment', 'classroom',
            'attendance_date', 'attendance_status',
            'check_in_time', 'check_out_time',
            'expected_arrival_time', 'expected_departure_time',
            'arrival_type', 'departure_type',
            'is_late', 'is_early_pickup',
            'late_reason', 'early_pickup_reason',
            'received_by', 'released_by', 'pickup_person',
            'remarks', 'notes',
            'is_corrected', 'correction_reason', 'corrected_by', 'corrected_at',
            'excused_reason_type', 'supporting_document',
            'student_name', 'student_admission_number', 'student_photo',
            'classroom_name', 'received_by_name', 'released_by_name',
            'pickup_person_name', 'created_by_name', 'updated_by_name',
            'corrected_by_name', 'supporting_document_title',
            'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}".strip()
        return ''

    def get_student_admission_number(self, obj):
        return obj.student.admission_number if obj.student else ''

    def get_student_photo(self, obj):
        return obj.student.photo if obj.student else ''

    def get_classroom_name(self, obj):
        return obj.classroom.room_name if obj.classroom else 'Unassigned'

    def get_received_by_name(self, obj):
        if obj.received_by:
            return f"{obj.received_by.first_name} {obj.received_by.last_name}".strip()
        return ''

    def get_released_by_name(self, obj):
        if obj.released_by:
            return f"{obj.released_by.first_name} {obj.released_by.last_name}".strip()
        return ''

    def get_pickup_person_name(self, obj):
        return obj.pickup_person.name if obj.pickup_person else ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name if name else obj.created_by.username
        return ''

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            name = f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip()
            return name if name else obj.updated_by.username
        return ''

    def get_corrected_by_name(self, obj):
        if obj.corrected_by:
            name = f"{obj.corrected_by.first_name} {obj.corrected_by.last_name}".strip()
            return name if name else obj.corrected_by.username
        return ''

    def get_supporting_document_title(self, obj):
        return obj.supporting_document.title if obj.supporting_document else ''

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

from .models import (
    DailyReport, MealRecord, NapRecord, ToiletingRecord,
    ActivityRecord, MoodRecord, DailyTemperatureRecord,
    DailyNoteRecord, DailyPhotoRecord
)

class MealRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MealRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class NapRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NapRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class ToiletingRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ToiletingRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class ActivityRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class MoodRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MoodRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class DailyTemperatureRecordSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyTemperatureRecord
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip() or obj.recorded_by.username
        return "Staff"


class DailyNoteRecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyNoteRecord
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "Staff"


class DailyPhotoRecordSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyPhotoRecord
        fields = '__all__'

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.username
        return "Staff"


class DailyReportSerializer(serializers.ModelSerializer):
    meals = MealRecordSerializer(many=True, read_only=True)
    naps = NapRecordSerializer(many=True, read_only=True)
    toileting = ToiletingRecordSerializer(many=True, read_only=True)
    activities = ActivityRecordSerializer(many=True, read_only=True)
    moods = MoodRecordSerializer(many=True, read_only=True)
    temperatures = DailyTemperatureRecordSerializer(many=True, read_only=True)
    staff_notes = DailyNoteRecordSerializer(many=True, read_only=True)
    photos = DailyPhotoRecordSerializer(many=True, read_only=True)

    child_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    child_photo = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True)
    teacher_name = serializers.SerializerMethodField()
    attendance_status = serializers.SerializerMethodField()
    medications = serializers.SerializerMethodField()
    incidents = serializers.SerializerMethodField()

    class Meta:
        model = DailyReport
        fields = '__all__'
        read_only_fields = ['daycare', 'created_at', 'updated_at']

    def get_child_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}".strip()
        return "Unknown Child"

    def get_student_name(self, obj):
        return self.get_child_name(obj)

    def get_child_photo(self, obj):
        if obj.student and hasattr(obj.student, 'profile_photo_path'):
            return obj.student.profile_photo_path
        return None

    def get_teacher_name(self, obj):
        if obj.teacher:
            return f"{obj.teacher.first_name} {obj.teacher.last_name}".strip() or obj.teacher.username
        return "Unassigned"

    def get_attendance_status(self, obj):
        if obj.attendance_record:
            return getattr(obj.attendance_record, 'attendance_status', getattr(obj.attendance_record, 'status', 'Present'))
        return "Unrecorded"

    def get_medications(self, obj):
        if not obj.student:
            return []
        from .models import MedicationAdministration
        admins = MedicationAdministration.objects.filter(
            medication__student=obj.student,
            date=obj.report_date
        ).select_related('medication', 'administered_by')
        res = []
        for a in admins:
            time_str = a.time.strftime('%H:%M') if getattr(a, 'time', None) else None
            res.append({
                'id': str(a.id),
                'medication_name': a.medication.medication_name if a.medication else 'Medication',
                'dosage': getattr(a, 'dosage_given', '') or (a.medication.dosage if a.medication else ''),
                'time': time_str,
                'administered_by_name': f"{a.administered_by.first_name} {a.administered_by.last_name}".strip() if a.administered_by else 'Staff',
                'notes': getattr(a, 'teacher_notes', '') or '',
                'status': 'Administered' if not getattr(a, 'missed_dose', False) else 'Missed'
            })
        return res

    def get_incidents(self, obj):
        if not obj.student:
            return []
        from .models import IncidentReport
        incidents = IncidentReport.objects.filter(
            student=obj.student,
            activity_date=obj.report_date
        ).select_related('reporting_employee')
        res = []
        for inc in incidents:
            res.append({
                'id': str(inc.id),
                'incident_type': inc.incident_type,
                'time': inc.time.strftime('%H:%M') if inc.time else None,
                'description': inc.description,
                'action_taken': inc.action_taken,
                'severity': inc.severity,
                'reporter_name': f"{inc.reporting_employee.first_name} {inc.reporting_employee.last_name}".strip() if inc.reporting_employee else 'Staff'
            })
        return res

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

from .models import Invoice, InvoiceItem, Payment, SubscriptionPlan, DaycareSubscription, SubscriptionFeature, RecurringBillingProfile

class InvoiceItemSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_structure_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'invoice', 'fee_structure', 'fee_structure_name', 'fee_type_code',
            'student', 'student_name', 'enrollment',
            'description', 'quantity', 'unit_price', 'subtotal',
            'discount_amount', 'discount_description', 'tax_amount', 'total',
            'service_period_start', 'service_period_end', 'attendance_basis_meta',
            'created_at', 'updated_at'
        ]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_fee_structure_name(self, obj):
        return obj.fee_structure.name if obj.fee_structure else None


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    daycare_name = serializers.CharField(source='daycare.name', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    net_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'daycare', 'daycare_name', 'invoice', 'invoice_number',
            'family', 'family_name', 'student', 'student_name',
            'receipt_number', 'amount', 'currency', 'net_amount',
            'payment_date', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'transaction_reference',
            'payer_name', 'payer_email',
            'refunded_amount', 'refund_reason', 'refunded_at',
            'notes', 'created_by', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'receipt_number', 'refunded_amount', 'refunded_at', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else (obj.student.child_families.first().family.family_name if obj.student and obj.student.child_families.exists() else None)



class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    total = serializers.DecimalField(source='total_amount', max_digits=12, decimal_places=2, read_only=True)
    student_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()
    branch_name = serializers.SerializerMethodField()
    daycare_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'daycare', 'daycare_name', 'family', 'family_name',
            'student', 'student_name', 'branch', 'branch_name', 'enrollment',
            'invoice_number', 'invoice_type', 'billing_period_start', 'billing_period_end',
            'issue_date', 'due_date', 'subtotal', 'discount_total', 'tax_total',
            'late_fee_total', 'credit_total', 'deposit_applied_total',
            'total_amount', 'total', 'amount_paid', 'balance_due', 'currency',
            'status', 'void_reason', 'cancelled_reason', 'notes', 'terms',
            'items', 'items_count', 'payments', 'recurring_profile',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'invoice_number', 'created_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else ""

    def get_branch_name(self, obj):
        return obj.branch.name if obj.branch else None

    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_items_count(self, obj):
        return obj.items.count()

class SubscriptionFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionFeature
        fields = '__all__'

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = '__all__'

class DaycareSubscriptionSerializer(serializers.ModelSerializer):
    plan_name = serializers.SerializerMethodField()
    daycare_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DaycareSubscription
        fields = '__all__'
        
    def get_plan_name(self, obj):
        return obj.subscription_plan.name if obj.subscription_plan else "None"
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else "None"
        
    def create(self, validated_data):
        from .models import SubscriptionInvoice, SubscriptionPayment
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta
        import uuid
        import random
        
        subscription = super().create(validated_data)
        if subscription.daycare:
            subscription.daycare.status = 'Active'
            subscription.daycare.save()
            
        amount = subscription.amount or 0
        invoice_number = f"INV-{timezone.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
        
        invoice = SubscriptionInvoice.objects.create(
            invoice_number=invoice_number,
            daycare=subscription.daycare,
            subscription=subscription,
            issue_date=timezone.now().date(),
            due_date=timezone.now().date(),
            amount=amount,
            tax=0,
            total=amount,
            status='paid',
            payment_date=timezone.now().date()
        )
        
        SubscriptionPayment.objects.create(
            daycare=subscription.daycare,
            invoice=invoice,
            subscription=subscription,
            amount=amount,
            payment_date=timezone.now().date(),
            currency='USD',
            payment_method='Credit Card (Mocked)',
            payment_status='completed',
            transaction_reference=f"txn_{uuid.uuid4().hex[:16]}"
        )
        
        if not subscription.start_date:
            subscription.start_date = timezone.now().date()
        
        if not subscription.expiry_date:
            cycle = subscription.billing_cycle
            delta = relativedelta(months=1)
            if cycle == 'Quarterly':
                delta = relativedelta(months=3)
            elif cycle == 'Annual':
                delta = relativedelta(years=1)
            subscription.expiry_date = subscription.start_date + delta
            subscription.renewal_date = subscription.expiry_date
            
        subscription.subscription_status = 'Active'
        subscription.save()
            
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
    daycare_limits = serializers.SerializerMethodField()
    phone = serializers.CharField(source='mobile', required=False, allow_null=True, allow_blank=True)
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'phone', 'role', 'daycare_name', 'daycare_limits', 'is_superuser']
        read_only_fields = ['id', 'email', 'role', 'daycare_name', 'daycare_limits', 'is_superuser']
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else None
        
    def get_daycare_limits(self, obj):
        if obj.daycare:
            active_sub = obj.daycare.subscriptions.filter(subscription_status__iexact='active').first()
            if not active_sub:
                active_sub = obj.daycare.subscriptions.filter(subscription_status__iexact='trial').first()
            if active_sub and active_sub.subscription_plan:
                return {
                    'max_branches': active_sub.subscription_plan.max_branches
                }
        return {'max_branches': 0}
        
    def get_role(self, obj):
        if obj.is_superuser:
            return 'Platform Admin'
        if hasattr(obj, 'guardian_profile'):
            return 'Guardian'
        return 'Daycare Admin'

from .models import Daycare, DaycareSettings

class DaycareSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DaycareSettings
        fields = '__all__'
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']

class AdminDaycareSerializer(serializers.ModelSerializer):
    class Meta:
        model = Daycare
        fields = '__all__'

class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name', 'role', 'daycare', 'is_staff', 'is_superuser', 'status', 'is_active']
        
    def get_role(self, obj):
        if obj.is_superuser:
            return 'Platform Admin'
        if hasattr(obj, 'guardian_profile'):
            return 'Guardian'
        return 'Daycare Admin'
        
    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

from .models import AgeGroup, RatioRule, RatioManualOverride, RatioComplianceHistory

class RatioRuleSerializer(serializers.ModelSerializer):
    province_code = serializers.CharField(source='province.code', read_only=True)
    province_name = serializers.CharField(source='province.name', read_only=True)
    program_name = serializers.CharField(source='program.name', read_only=True)
    age_group_name = serializers.CharField(source='age_group.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    effective_until = serializers.DateField(source='effective_to', required=False, allow_null=True)
    active = serializers.BooleanField(source='is_active', required=False)

    class Meta:
        model = RatioRule
        fields = [
            'id', 'daycare', 'province', 'province_code', 'province_name',
            'program', 'program_name', 'program_type', 'age_group', 'age_group_name',
            'name', 'min_age_months', 'max_age_months',
            'minimum_children', 'maximum_children', 'required_staff', 'qualified_staff_required',
            'max_children_per_staff', 'warning_threshold_buffer',
            'requires_qualified_ece', 'qualification_requirement',
            'effective_from', 'effective_to', 'effective_until',
            'is_system_rule', 'is_active', 'active',
            'notes', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        full = obj.created_by.get_full_name()
        return full if full else obj.created_by.username

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return None
        full = obj.updated_by.get_full_name()
        return full if full else obj.updated_by.username

    def validate(self, attrs):
        import datetime
        from django.db.models import Q

        # Handle alias writes if passed in initial_data
        if 'effective_until' in self.initial_data and 'effective_to' not in attrs:
            val = self.initial_data.get('effective_until')
            if val:
                try:
                    attrs['effective_to'] = datetime.datetime.strptime(val, '%Y-%m-%d').date() if isinstance(val, str) else val
                except ValueError:
                    pass
            else:
                attrs['effective_to'] = None

        if 'active' in self.initial_data and 'is_active' not in attrs:
            attrs['is_active'] = bool(self.initial_data.get('active'))

        effective_from = attrs.get('effective_from', getattr(self.instance, 'effective_from', datetime.date.today()))
        effective_to = attrs.get('effective_to', getattr(self.instance, 'effective_to', None))

        if effective_to and effective_from and effective_to < effective_from:
            raise serializers.ValidationError({
                "effective_to": "effective_to cannot be earlier than effective_from."
            })

        min_age = attrs.get('min_age_months', getattr(self.instance, 'min_age_months', 0))
        max_age = attrs.get('max_age_months', getattr(self.instance, 'max_age_months', 72))

        if min_age is not None and min_age < 0:
            raise serializers.ValidationError({
                "min_age_months": "min_age_months cannot be negative."
            })
        if max_age is not None and min_age is not None and max_age < min_age:
            raise serializers.ValidationError({
                "max_age_months": "max_age_months cannot be less than min_age_months."
            })

        min_children = attrs.get('minimum_children', getattr(self.instance, 'minimum_children', 0))
        max_children = attrs.get('maximum_children', getattr(self.instance, 'maximum_children', None))

        if min_children is not None and min_children < 0:
            raise serializers.ValidationError({
                "minimum_children": "minimum_children cannot be negative."
            })
        if max_children is not None and min_children is not None and max_children < min_children:
            raise serializers.ValidationError({
                "maximum_children": "maximum_children cannot be less than minimum_children."
            })

        max_cps = attrs.get('max_children_per_staff', getattr(self.instance, 'max_children_per_staff', 5))
        if max_cps is not None and max_cps < 1:
            raise serializers.ValidationError({
                "max_children_per_staff": "max_children_per_staff must be at least 1."
            })

        req_staff = attrs.get('required_staff', getattr(self.instance, 'required_staff', 1))
        if req_staff is not None and req_staff < 1:
            raise serializers.ValidationError({
                "required_staff": "required_staff must be at least 1."
            })

        qual_staff = attrs.get('qualified_staff_required', getattr(self.instance, 'qualified_staff_required', 1))
        if qual_staff is not None and qual_staff < 0:
            raise serializers.ValidationError({
                "qualified_staff_required": "qualified_staff_required cannot be negative."
            })
        if qual_staff is not None and req_staff is not None and qual_staff > req_staff:
            raise serializers.ValidationError({
                "qualified_staff_required": "qualified_staff_required cannot exceed required_staff."
            })

        warn_buf = attrs.get('warning_threshold_buffer', getattr(self.instance, 'warning_threshold_buffer', 1))
        if warn_buf is not None and warn_buf < 0:
            raise serializers.ValidationError({
                "warning_threshold_buffer": "warning_threshold_buffer cannot be negative."
            })

        # Overlapping Active Rules Detection
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))
        if is_active:
            daycare = attrs.get('daycare', getattr(self.instance, 'daycare', None))
            if not daycare and self.context.get('request'):
                req = self.context.get('request')
                u = getattr(req, 'user', None)
                if u and hasattr(u, 'daycare') and u.daycare:
                    daycare = u.daycare
                elif u and hasattr(u, 'employee_profile') and u.employee_profile and getattr(u.employee_profile, 'daycare', None):
                    daycare = u.employee_profile.daycare

            province = attrs.get('province', getattr(self.instance, 'province', None))
            program = attrs.get('program', getattr(self.instance, 'program', None))
            program_type = attrs.get('program_type', getattr(self.instance, 'program_type', None))
            age_group = attrs.get('age_group', getattr(self.instance, 'age_group', None))

            qs = RatioRule.objects.filter(is_active=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if daycare:
                qs = qs.filter(daycare=daycare)
            else:
                qs = qs.filter(Q(daycare__isnull=True) | Q(is_system_rule=True))
                if province:
                    qs = qs.filter(province=province)

            # Scope and date range overlap condition
            for existing in qs:
                # If both specify programs and they differ, no conflict
                if (program or program_type) and (existing.program or existing.program_type):
                    p1 = str(program.id) if program else (program_type or "").lower()
                    p2 = str(existing.program.id) if existing.program else (existing.program_type or "").lower()
                    if p1 != p2:
                        continue

                # If both specify age groups and they differ, no conflict
                if age_group and existing.age_group:
                    if age_group.id != existing.age_group.id:
                        continue
                else:
                    # Check age range strictly: [A, B] and [C, D] overlap if A < D and B > C
                    e_min = existing.min_age_months if existing.min_age_months is not None else 0
                    e_max = existing.max_age_months if existing.max_age_months is not None else 72
                    if not (min_age < e_max and max_age > e_min):
                        continue

                e_start = existing.effective_from
                e_end = existing.effective_to

                # Date overlap check
                start_before_end = (e_end is None or effective_from <= e_end)
                end_after_start = (effective_to is None or effective_to >= e_start)

                if start_before_end and end_after_start:
                    raise serializers.ValidationError({
                        "non_field_errors": [
                            f"An active ratio rule '{existing.name}' already exists for this scope with an overlapping effective date range."
                        ]
                    })

        return attrs


class RatioManualOverrideSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = RatioManualOverride
        fields = [
            'id', 'daycare', 'classroom', 'classroom_name',
            'override_status', 'reason', 'created_by', 'created_by_name',
            'created_at', 'expires_at', 'is_active', 'is_expired'
        ]
        read_only_fields = ['id', 'daycare', 'created_by', 'created_at', 'is_expired']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return "System"
        full = obj.created_by.get_full_name()
        return full if full else obj.created_by.username


class RatioComplianceHistorySerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True)
    classroom_code = serializers.CharField(source='classroom.room_code', read_only=True)
    override_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RatioComplianceHistory
        fields = [
            'id', 'daycare', 'classroom', 'classroom_name', 'classroom_code',
            'evaluated_at', 'children_present', 'qualified_staff_present',
            'total_staff_present', 'required_staff', 'calculated_ratio',
            'calculated_status', 'rule_used', 'rule_snapshot',
            'override_applied', 'override_status', 'override_reason',
            'override_by', 'override_by_name', 'final_status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_override_by_name(self, obj):
        if not obj.override_by:
            return None
        full = obj.override_by.get_full_name()
        return full if full else obj.override_by.username

from .models import ClassroomTeacherAssignment, Employee

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
    compliance_status = serializers.SerializerMethodField()
    compliance_reason = serializers.SerializerMethodField()
    
    class Meta:
        model = Employee
        fields = ['id', 'name', 'employee_number', 'email', 'role', 'compliance_status', 'compliance_reason']
        
    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
        
    def get_email(self, obj):
        return obj.email or (obj.user.email if obj.user else None)

    def get_compliance_status(self, obj):
        try:
            from daycare.services.compliance import ComplianceService
            res = ComplianceService.evaluate_employee_compliance(obj)
            return res.get('compliance_status', 'COMPLIANT')
        except Exception:
            return 'COMPLIANT'

    def get_compliance_reason(self, obj):
        try:
            from daycare.services.compliance import ComplianceService
            res = ComplianceService.evaluate_employee_compliance(obj)
            return res.get('compliance_reason', 'All requirements verified')
        except Exception:
            return 'All requirements verified'

class ClassroomTeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher = AvailableTeacherSerializer(source='employee', read_only=True)
    compliance_status = serializers.SerializerMethodField()
    compliance_reason = serializers.SerializerMethodField()
    
    class Meta:
        model = ClassroomTeacherAssignment
        fields = '__all__'
        read_only_fields = ['daycare', 'created_by', 'updated_by', 'assigned_date']

    def get_compliance_status(self, obj):
        if not obj.employee:
            return 'COMPLIANT'
        try:
            from daycare.services.compliance import ComplianceService
            res = ComplianceService.evaluate_employee_compliance(obj.employee)
            return res.get('compliance_status', 'COMPLIANT')
        except Exception:
            return 'COMPLIANT'

    def get_compliance_reason(self, obj):
        if not obj.employee:
            return ''
        try:
            from daycare.services.compliance import ComplianceService
            res = ComplianceService.evaluate_employee_compliance(obj.employee)
            return res.get('compliance_reason', '')
        except Exception:
            return ''


from .models import Branch, TimeOffRequest, StaffAttendance, StaffBreak

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'
        read_only_fields = ['daycare']

class TimeOffRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TimeOffRequest
        fields = '__all__'
        
    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

class StaffBreakSerializer(serializers.ModelSerializer):
    duration_minutes = serializers.ReadOnlyField()
    duration_hours = serializers.ReadOnlyField()

    class Meta:
        model = StaffBreak
        fields = [
            'id', 'attendance', 'break_start', 'break_end',
            'break_type', 'is_paid', 'notes', 'duration_minutes',
            'duration_hours', 'created_at', 'updated_at'
        ]

class StaffAttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_role = serializers.SerializerMethodField()
    employee_photo = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    branch_name = serializers.SerializerMethodField()
    breaks = StaffBreakSerializer(many=True, read_only=True)
    total_duration_hours = serializers.ReadOnlyField()
    total_unpaid_break_hours = serializers.ReadOnlyField()
    total_paid_break_hours = serializers.ReadOnlyField()
    total_break_hours = serializers.ReadOnlyField()
    total_break_minutes = serializers.ReadOnlyField()
    actual_working_hours = serializers.ReadOnlyField()
    scheduled_hours = serializers.ReadOnlyField()
    variance_minutes = serializers.ReadOnlyField()
    scheduled_shift_info = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    corrected_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    overtime_candidate_hours = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()

    class Meta:
        model = StaffAttendance
        fields = '__all__'

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip()
        return None

    def get_employee_role(self, obj):
        if obj.employee:
            return obj.employee.role
        return None

    def get_employee_photo(self, obj):
        if obj.employee and getattr(obj.employee, 'photo', None):
            return obj.employee.photo.url if hasattr(obj.employee.photo, 'url') else str(obj.employee.photo)
        return None

    def get_classroom_name(self, obj):
        if obj.classroom:
            return obj.classroom.room_name
        return None

    def get_branch_name(self, obj):
        if obj.branch:
            return obj.branch.name
        return None

    def get_scheduled_shift_info(self, obj):
        if obj.scheduled_shift:
            s = obj.scheduled_shift
            return {
                "id": str(s.id),
                "date": str(s.date),
                "shift_start": str(s.shift_start) if s.shift_start else None,
                "shift_end": str(s.shift_end) if s.shift_end else None,
                "shift_type": s.shift_type,
                "net_working_hours": s.net_working_hours,
                "classroom_name": s.classroom.room_name if s.classroom else None,
            }
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            emp = getattr(obj.approved_by, 'employee_profile', None)
            if emp:
                emp_name = f"{emp.first_name} {emp.last_name}".strip()
                if emp_name:
                    return emp_name
            name = f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
            return name if name else obj.approved_by.username
        return None

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            emp = getattr(obj.submitted_by, 'employee_profile', None)
            if emp:
                emp_name = f"{emp.first_name} {emp.last_name}".strip()
                if emp_name:
                    return emp_name
            name = f"{obj.submitted_by.first_name} {obj.submitted_by.last_name}".strip()
            return name if name else obj.submitted_by.username
        return None

    def get_corrected_by_name(self, obj):
        if obj.corrected_by:
            emp = getattr(obj.corrected_by, 'employee_profile', None)
            if emp:
                emp_name = f"{emp.first_name} {emp.last_name}".strip()
                if emp_name:
                    return emp_name
            name = f"{obj.corrected_by.first_name} {obj.corrected_by.last_name}".strip()
            return name if name else obj.corrected_by.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_overtime_candidate_hours(self, obj):
        if obj.actual_working_hours:
            return round(max(0.0, float(obj.actual_working_hours) - 8.0), 2)
        return 0.0

    def get_can_approve(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        user = request.user
        if user.is_superuser or (user.is_staff and getattr(user, 'role', '') == 'Super Admin'):
            return True
        is_mgr = user.is_staff or getattr(user, 'role', '') in ('Daycare Admin', 'Owner', 'Director', 'Manager')
        if not is_mgr:
            return False
        # Self-approval prevention
        if obj.employee and obj.employee.user_id == user.id:
            return False
        return True

from .models import AuditLog, SupportTicket, SupportTicketMessage, SubscriptionInvoice, SubscriptionPayment, SystemAnnouncement

class SystemAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemAnnouncement
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = '__all__'

class SupportTicketMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicketMessage
        fields = '__all__'
        
    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}" if obj.sender else "System"

class SupportTicketSerializer(serializers.ModelSerializer):
    messages = SupportTicketMessageSerializer(many=True, read_only=True)
    daycare_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicket
        fields = '__all__'
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else "Unknown"

class SubscriptionInvoiceSerializer(serializers.ModelSerializer):
    daycare_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SubscriptionInvoice
        fields = '__all__'
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else "Unknown"

class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    daycare_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SubscriptionPayment
        fields = '__all__'
        
    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else "Unknown"


from .models import ChildVaccinationRecord, DocumentExpiration

class ChildVaccinationRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChildVaccinationRecord
        fields = '__all__'
        read_only_fields = ['student', 'created_at', 'updated_at']


from .models import ClassroomStudent, Classroom

class SimpleClassroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = ['id', 'room_name', 'room_code', 'capacity', 'min_age_months', 'max_age_months']

class ChildClassroomAssignmentSerializer(serializers.ModelSerializer):
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True)
    
    class Meta:
        model = ClassroomStudent
        fields = '__all__'
        read_only_fields = ['student']
        validators = []


class ChildDocumentSerializer(serializers.ModelSerializer):
    expiry_date = serializers.DateField(write_only=True, required=False, allow_null=True)
    current_expiry_date = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Document
        fields = '__all__'
        read_only_fields = ['content_type', 'object_id', 'uploaded_by', 'daycare']
        
    def get_current_expiry_date(self, obj):
        try:
            return obj.expiration.expiry_date
        except DocumentExpiration.DoesNotExist:
            return None
            
    def create(self, validated_data):
        expiry_date = validated_data.pop('expiry_date', None)
        document = super().create(validated_data)
        if expiry_date:
            DocumentExpiration.objects.create(
                document=document,
                expiry_date=expiry_date
            )
        return document
        
    def update(self, instance, validated_data):
        expiry_date = validated_data.pop('expiry_date', None)
        document = super().update(instance, validated_data)
        if expiry_date:
            expiration, created = DocumentExpiration.objects.get_or_create(
                document=document,
                defaults={'expiry_date': expiry_date}
            )
            if not created:
                expiration.expiry_date = expiry_date
                expiration.save()
        return document

from .models import Family, Guardian, FamilyGuardian, FamilyChild, GuardianCommunicationPreference

class FamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = Family
        fields = ['id', 'family_name', 'status', 'primary_contact', 'primary_email', 'primary_phone', 'address', 'notes']
        read_only_fields = ['id', 'status']

class GuardianSerializer(serializers.ModelSerializer):
    relationship = serializers.SerializerMethodField(read_only=True)
    is_primary = serializers.SerializerMethodField(read_only=True)
    communication_preferences = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Guardian
        fields = ['id', 'first_name', 'last_name', 'preferred_name', 'email', 'phone', 'relationship', 'is_primary', 'status', 'communication_preferences']
        read_only_fields = ['id', 'status']

    def get_relationship(self, obj):
        family = self.context.get('family')
        if family:
            fg = FamilyGuardian.objects.filter(family=family, guardian=obj).first()
            return fg.relationship if fg else None
        return None

    def get_is_primary(self, obj):
        family = self.context.get('family')
        if family:
            fg = FamilyGuardian.objects.filter(family=family, guardian=obj).first()
            return fg.is_primary if fg else False
        return False

    def get_communication_preferences(self, obj):
        if hasattr(obj, 'communication_preference'):
            pref = obj.communication_preference
            return {
                'email_alerts': pref.email_alerts,
                'sms_alerts': pref.sms_alerts,
                'emergency_alerts_only': pref.emergency_alerts_only
            }
        return {'email_alerts': True, 'sms_alerts': False, 'emergency_alerts_only': False}


# ─── Family Portal Serializers ───────────────────────────────────────────────

from .models import (
    FamilyMessage, ConsentForm, ConsentFormAssignment, ConsentFormSignature,
    Invoice, InvoiceItem, Payment,
    StudentAttendance, DailyReport,
    MealRecord, NapRecord, ToiletingRecord, ActivityRecord, MoodRecord,
    StudentEmergencyContact, StudentPickup,
)


class FamilyMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = FamilyMessage
        fields = [
            'id', 'subject', 'body', 'message_type', 'is_read', 'read_at',
            'sender_name', 'sender_role', 'reply_count',
            'parent_message', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'sender_name', 'sender_role', 'reply_count', 'is_read', 'read_at', 'created_at', 'updated_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username

    def get_sender_role(self, obj):
        if obj.sender.is_superuser:
            return 'Platform Admin'
        if hasattr(obj.sender, 'guardian_profile'):
            return 'Guardian'
        return 'Staff'

    def get_reply_count(self, obj):
        return obj.replies.count()


class ConsentFormSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConsentForm
        fields = [
            'id', 'title', 'description', 'content', 'form_type',
            'requires_signature', 'status', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by_name', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''


class ConsentFormSignatureSerializer(serializers.ModelSerializer):
    signed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ConsentFormSignature
        fields = ['id', 'signed_by_name', 'signature_name', 'signed_at', 'agreement_text']
        read_only_fields = ['id', 'signed_by_name', 'signed_at']

    def get_signed_by_name(self, obj):
        return obj.signed_by.get_full_name() or obj.signed_by.username


class ConsentFormAssignmentSerializer(serializers.ModelSerializer):
    form_title = serializers.CharField(source='consent_form.title', read_only=True)
    form_type = serializers.CharField(source='consent_form.form_type', read_only=True)
    form_description = serializers.CharField(source='consent_form.description', read_only=True)
    form_content = serializers.CharField(source='consent_form.content', read_only=True)
    requires_signature = serializers.BooleanField(source='consent_form.requires_signature', read_only=True)
    student_name = serializers.SerializerMethodField()
    signature = ConsentFormSignatureSerializer(read_only=True)

    class Meta:
        model = ConsentFormAssignment
        fields = [
            'id', 'consent_form', 'form_title', 'form_type', 'form_description',
            'form_content', 'requires_signature', 'student', 'student_name',
            'status', 'due_date', 'signature', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'student_name', 'signature', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


class FamilyInvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total']


class FamilyInvoiceSerializer(serializers.ModelSerializer):
    items = FamilyInvoiceItemSerializer(many=True, read_only=True)
    student_name = serializers.SerializerMethodField()
    amount_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'student', 'student_name',
            'issue_date', 'due_date', 'subtotal', 'tax', 'discount',
            'total_amount', 'amount_paid', 'amount_due', 'status', 'notes', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['__all__']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else (obj.family.family_name if obj.family else "Childcare Statement")

    def get_amount_due(self, obj):
        return float(obj.total_amount or 0) - float(obj.amount_paid or 0)


class FamilyPaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'invoice_number', 'student', 'student_name',
            'amount', 'payment_date', 'payment_method', 'transaction_reference',
            'notes', 'created_at'
        ]
        read_only_fields = ['__all__']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"


from .models import (
    DailyTemperatureRecord, DailyNoteRecord, DailyPhotoRecord,
    IncidentReport, MedicationAdministration
)

class FamilyDailyReportSerializer(serializers.ModelSerializer):
    child_id = serializers.CharField(source='student.id', read_only=True)
    child_name = serializers.SerializerMethodField()
    preferred_name = serializers.CharField(source='student.preferred_name', read_only=True, default='')
    child_photo = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True, default='Unassigned')
    teacher_name = serializers.SerializerMethodField()
    attendance_status = serializers.SerializerMethodField()
    check_in_time = serializers.SerializerMethodField()
    check_out_time = serializers.SerializerMethodField()

    meals = serializers.SerializerMethodField()
    snacks = serializers.SerializerMethodField()
    naps = serializers.SerializerMethodField()
    diapers = serializers.SerializerMethodField()
    toileting = serializers.SerializerMethodField()
    moods = serializers.SerializerMethodField()
    activities = serializers.SerializerMethodField()
    learning = serializers.SerializerMethodField()
    outdoor_play = serializers.SerializerMethodField()
    temperatures = serializers.SerializerMethodField()
    medications = serializers.SerializerMethodField()
    incidents = serializers.SerializerMethodField()
    staff_notes = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    care_summary = serializers.SerializerMethodField()
    checklist = serializers.SerializerMethodField()

    class Meta:
        model = DailyReport
        fields = [
            'id', 'student', 'child_id', 'child_name', 'preferred_name', 'child_photo',
            'report_date', 'status', 'classroom_name', 'teacher_name',
            'attendance_status', 'check_in_time', 'check_out_time',
            'notes', 'submitted_at', 'completed_at', 'published_at', 'created_at',
            'meals', 'snacks', 'naps', 'diapers', 'toileting',
            'moods', 'activities', 'learning', 'outdoor_play',
            'temperatures', 'medications', 'incidents', 'staff_notes',
            'photos', 'care_summary', 'checklist'
        ]

    def get_child_name(self, obj):
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}".strip()
        return "Child"

    def get_child_photo(self, obj):
        if obj.student and hasattr(obj.student, 'photo') and obj.student.photo:
            return obj.student.photo
        if obj.student and hasattr(obj.student, 'profile_photo_path') and obj.student.profile_photo_path:
            return obj.student.profile_photo_path
        return None

    def get_teacher_name(self, obj):
        if obj.teacher:
            name = f"{obj.teacher.first_name} {obj.teacher.last_name}".strip()
            return name or obj.teacher.username
        return "Educator"

    def get_attendance_status(self, obj):
        if obj.attendance_record:
            return getattr(obj.attendance_record, 'attendance_status', getattr(obj.attendance_record, 'status', 'Present'))
        return "Not Recorded"

    def get_check_in_time(self, obj):
        if obj.attendance_record and obj.attendance_record.check_in_time:
            return obj.attendance_record.check_in_time.strftime('%I:%M %p')
        return None

    def get_check_out_time(self, obj):
        if obj.attendance_record and obj.attendance_record.check_out_time:
            return obj.attendance_record.check_out_time.strftime('%I:%M %p')
        return None

    def get_meals(self, obj):
        records = obj.meals.filter(meal_category='Meal')
        return [
            {
                'id': str(m.id),
                'meal_type': m.meal_type,
                'food_provided': m.food_provided or 'Not Recorded',
                'amount_eaten': m.amount_eaten or 'Not Recorded',
                'time': m.time.strftime('%I:%M %p') if m.time else None,
                'notes': m.notes or '',
            }
            for m in records
        ]

    def get_snacks(self, obj):
        records = obj.meals.filter(meal_category='Snack')
        return [
            {
                'id': str(m.id),
                'snack_type': m.meal_type,
                'food_provided': m.food_provided or 'Not Recorded',
                'amount_eaten': m.amount_eaten or 'Not Recorded',
                'time': m.time.strftime('%I:%M %p') if m.time else None,
                'notes': m.notes or '',
            }
            for m in records
        ]

    def get_naps(self, obj):
        records = obj.naps.all()
        res = []
        for n in records:
            start_str = n.start_time.strftime('%I:%M %p') if n.start_time else ''
            end_str = n.end_time.strftime('%I:%M %p') if n.end_time else 'In progress'
            res.append({
                'id': str(n.id),
                'start_time': start_str,
                'end_time': end_str,
                'duration_minutes': n.duration_minutes,
                'quality': n.quality or 'Slept',
                'notes': n.notes or '',
            })
        return res

    def get_diapers(self, obj):
        records = obj.toileting.filter(type__iexact='Diaper')
        return [
            {
                'id': str(t.id),
                'condition': t.condition or 'Clean',
                'time': t.time.strftime('%I:%M %p') if t.time else None,
                'assistance_level': t.assistance_level,
                'notes': t.notes or '',
            }
            for t in records
        ]

    def get_toileting(self, obj):
        records = obj.toileting.filter(Q(type__iexact='Potty') | Q(type__iexact='Toilet') | Q(type__iexact='Accident'))
        return [
            {
                'id': str(t.id),
                'type': t.type,
                'condition': t.condition or 'Successful',
                'time': t.time.strftime('%I:%M %p') if t.time else None,
                'assistance_level': t.assistance_level or 'Prompted',
                'notes': t.notes or '',
            }
            for t in records
        ]

    def get_moods(self, obj):
        records = obj.moods.all()
        return [
            {
                'id': str(m.id),
                'mood': m.mood,
                'time': m.time.strftime('%I:%M %p') if m.time else None,
                'notes': m.notes or '',
            }
            for m in records
        ]

    def get_activities(self, obj):
        records = obj.activities.filter(activity_category__in=['General Activity', 'Circle Time', 'Sensory', 'Creative Arts', 'Music', 'STEM', 'Other'])
        return [
            {
                'id': str(a.id),
                'activity_type': a.activity_type,
                'name': a.name or a.activity_type,
                'description': a.description or '',
                'teacher_notes': a.teacher_notes or '',
                'participation': a.participation or 'Participated',
                'start_time': a.start_time.strftime('%I:%M %p') if a.start_time else None,
                'end_time': a.end_time.strftime('%I:%M %p') if a.end_time else None,
                'duration_minutes': a.duration_minutes,
            }
            for a in records
        ]

    def get_learning(self, obj):
        records = obj.activities.filter(Q(activity_category='Learning & Development') | Q(learning_area__isnull=False))
        return [
            {
                'id': str(a.id),
                'learning_area': a.learning_area or 'Cognitive Development',
                'name': a.name or 'Learning Activity',
                'description': a.description or '',
                'observations': a.teacher_notes or '',
                'participation': a.participation or 'High',
            }
            for a in records
        ]

    def get_outdoor_play(self, obj):
        records = obj.activities.filter(activity_category='Outdoor Play')
        return [
            {
                'id': str(a.id),
                'name': a.name or 'Outdoor Playground',
                'description': a.description or '',
                'duration_minutes': a.duration_minutes,
                'start_time': a.start_time.strftime('%I:%M %p') if a.start_time else None,
                'end_time': a.end_time.strftime('%I:%M %p') if a.end_time else None,
                'observations': a.teacher_notes or '',
            }
            for a in records
        ]

    def get_temperatures(self, obj):
        records = obj.temperatures.all()
        return [
            {
                'id': str(t.id),
                'temperature_value': str(t.temperature_value),
                'unit': t.unit,
                'method': t.method,
                'time': t.time.strftime('%I:%M %p') if t.time else None,
                'notes': t.notes or '',
            }
            for t in records
        ]

    def get_medications(self, obj):
        if not obj.student:
            return []
        from .models import MedicationAdministration
        admins = MedicationAdministration.objects.filter(
            medication__student=obj.student,
            date=obj.report_date
        ).select_related('medication')
        # Privacy sanitization: No internal witness details or staff notes
        return [
            {
                'id': str(a.id),
                'medication_name': a.medication.medication_name if a.medication else 'Prescribed Medication',
                'dosage_given': a.dosage_given or (a.medication.dosage if a.medication else ''),
                'time': a.time.strftime('%I:%M %p') if a.time else None,
                'status': 'Administered' if not getattr(a, 'missed_dose', False) else 'Missed',
            }
            for a in admins
        ]

    def get_incidents(self, obj):
        if not obj.student:
            return []
        from .models import IncidentReport
        incidents = IncidentReport.objects.filter(
            student=obj.student,
            activity_date=obj.report_date
        )
        # Privacy sanitization: Parent receives summary and action taken only (no internal witness or staff liability notes)
        return [
            {
                'id': str(inc.id),
                'incident_type': inc.incident_type,
                'time': inc.time.strftime('%I:%M %p') if inc.time else None,
                'description': inc.description,
                'action_taken': inc.action_taken,
                'severity': inc.severity,
            }
            for inc in incidents
        ]

    def get_staff_notes(self, obj):
        records = obj.staff_notes.all()
        return [
            {
                'id': str(n.id),
                'category': n.category,
                'note_text': n.note_text,
                'time': n.time.strftime('%I:%M %p') if n.time else None,
            }
            for n in records
        ]

    def get_photos(self, obj):
        records = obj.photos.all()
        return [
            {
                'id': str(p.id),
                'photo_url': p.photo_url or (p.file_path.url if p.file_path else ''),
                'caption': p.caption or '',
                'activity_context': p.activity_context or '',
            }
            for p in records
        ]

    def get_care_summary(self, obj):
        meals = obj.meals.filter(meal_category='Meal')
        meal_parts = [f"{m.meal_type} – {m.amount_eaten or 'Recorded'}" for m in meals]
        meals_summary = ", ".join(meal_parts) if meal_parts else "Not Recorded"

        naps = obj.naps.all()
        nap_parts = [
            f"{n.start_time.strftime('%I:%M %p')} – {n.end_time.strftime('%I:%M %p') if n.end_time else 'In progress'}"
            for n in naps
        ]
        naps_summary = ", ".join(nap_parts) if nap_parts else "Not Recorded"

        moods = obj.moods.all()
        mood_parts = [m.mood for m in moods]
        mood_summary = " / ".join(dict.fromkeys(mood_parts)) if mood_parts else "Not Recorded"

        return {
            'meals_summary': meals_summary,
            'naps_summary': naps_summary,
            'mood_summary': mood_summary,
        }

    def get_checklist(self, obj):
        from daycare.services.daily_reports import DailyReportService
        return DailyReportService.get_report_completion_checklist(obj)


class FamilyAttendanceSerializer(serializers.ModelSerializer):
    received_by_name = serializers.SerializerMethodField()
    released_by_name = serializers.SerializerMethodField()
    pickup_person_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentAttendance
        fields = [
            'id', 'attendance_date', 'attendance_status',
            'check_in_time', 'check_out_time',
            'received_by_name', 'released_by_name', 'pickup_person_name',
            'remarks', 'created_at'
        ]

    def get_received_by_name(self, obj):
        if obj.received_by:
            return f"{obj.received_by.first_name} {obj.received_by.last_name}"
        return ''

    def get_released_by_name(self, obj):
        if obj.released_by:
            return f"{obj.released_by.first_name} {obj.released_by.last_name}"
        return ''

    def get_pickup_person_name(self, obj):
        return obj.pickup_person.name if obj.pickup_person else ''


class FamilyEmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentEmergencyContact
        fields = ['id', 'name', 'relationship', 'mobile', 'email', 'is_primary', 'approval_status', 'pending_changes']
        read_only_fields = ['id', 'approval_status']


class FamilyAuthorizedPickupSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_effective = serializers.BooleanField(read_only=True)
    photo_url = serializers.SerializerMethodField()
    person_name = serializers.CharField(source='name', required=False)
    relationship_to_child = serializers.CharField(source='relationship', required=False)

    class Meta:
        model = StudentPickup
        fields = [
            'id', 'name', 'person_name', 'relationship', 'relationship_to_child',
            'phone', 'email', 'photo', 'photo_url', 'authorization_status',
            'valid_from', 'valid_until', 'notes', 'status', 'approval_status',
            'id_proof_status', 'pending_changes', 'is_expired', 'is_effective',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'approval_status', 'id_proof_status', 'created_at', 'updated_at']

    def get_photo_url(self, obj):
        if obj.photo:
            return f"/api/family/authorized-pickups/{obj.id}/photo/"
        return None



class EmploymentHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentHistory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class EmployeeCompensationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeCompensation
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class ShiftBreakSerializer(serializers.ModelSerializer):
    duration_minutes = serializers.ReadOnlyField()

    class Meta:
        model = ShiftBreak
        fields = [
            'id', 'schedule', 'break_start', 'break_end', 'break_type',
            'is_paid', 'duration_minutes', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'schedule', 'created_at', 'updated_at']

    def validate(self, attrs):
        break_start = attrs.get('break_start') or (self.instance.break_start if self.instance else None)
        break_end = attrs.get('break_end') or (self.instance.break_end if self.instance else None)
        schedule = attrs.get('schedule') or (self.instance.schedule if self.instance else None) or self.context.get('schedule')

        if break_start and break_end and schedule:
            from daycare.services.scheduling import SchedulingService
            SchedulingService.validate_break(
                schedule=schedule,
                break_start=break_start,
                break_end=break_end,
                exclude_break_id=str(self.instance.id) if self.instance else None
            )

        return attrs

    def create(self, validated_data):
        schedule = validated_data.get('schedule') or self.context.get('schedule')
        if not schedule:
            raise serializers.ValidationError({"schedule": "Schedule is required."})
        validated_data['schedule'] = schedule
        return super().create(validated_data)



class StaffScheduleSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_job_title = serializers.CharField(source='employee.job_title', read_only=True)
    employee_role = serializers.CharField(source='employee.role', read_only=True)
    employee_photo = serializers.CharField(source='employee.photo', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    classroom_name = serializers.CharField(source='classroom.room_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    duration_hours = serializers.SerializerMethodField()
    total_shift_hours = serializers.ReadOnlyField()
    unpaid_break_hours = serializers.ReadOnlyField(source='total_unpaid_break_hours')
    paid_break_hours = serializers.ReadOnlyField(source='total_paid_break_hours')
    net_working_hours = serializers.ReadOnlyField()
    breaks = ShiftBreakSerializer(many=True, required=False)

    class Meta:
        model = StaffSchedule
        fields = [
            'id', 'daycare', 'employee', 'employee_name', 'employee_job_title',
            'employee_role', 'employee_photo', 'employee_number',
            'date', 'shift_start', 'shift_end', 'shift_type',
            'classroom', 'classroom_name', 'branch', 'branch_name',
            'status', 'duties', 'notes', 'created_by', 'created_by_name',
            'duration_hours', 'total_shift_hours', 'unpaid_break_hours',
            'paid_break_hours', 'net_working_hours', 'breaks',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'daycare', 'created_by', 'total_shift_hours',
            'unpaid_break_hours', 'paid_break_hours', 'net_working_hours',
            'created_at', 'updated_at'
        ]

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip()
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return ""

    def get_duration_hours(self, obj):
        return obj.total_shift_hours

    def validate(self, attrs):
        request = self.context.get('request')
        daycare = getattr(request.user, 'daycare', None) if request else None

        employee = attrs.get('employee') or (self.instance.employee if self.instance else None)
        shift_date = attrs.get('date') or (self.instance.date if self.instance else None)
        shift_start = attrs.get('shift_start') or (self.instance.shift_start if self.instance else None)
        shift_end = attrs.get('shift_end') or (self.instance.shift_end if self.instance else None)
        classroom = attrs.get('classroom', self.instance.classroom if self.instance else None)
        branch = attrs.get('branch', self.instance.branch if self.instance else None)

        if daycare and employee and shift_date and shift_start and shift_end:
            from daycare.services.scheduling import SchedulingService
            SchedulingService.validate_shift(
                daycare=daycare,
                employee=employee,
                shift_date=shift_date,
                shift_start=shift_start,
                shift_end=shift_end,
                classroom=classroom,
                branch=branch,
                exclude_schedule_id=str(self.instance.id) if self.instance else None
            )

        return attrs

    def create(self, validated_data):
        breaks_data = validated_data.pop('breaks', [])
        schedule = StaffSchedule.objects.create(**validated_data)

        from daycare.services.scheduling import SchedulingService
        for b_data in breaks_data:
            b_start = b_data['break_start']
            b_end = b_data['break_end']
            SchedulingService.validate_break(schedule, b_start, b_end)
            ShiftBreak.objects.create(schedule=schedule, **b_data)

        return schedule

    def update(self, instance, validated_data):
        breaks_data = validated_data.pop('breaks', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if breaks_data is not None:
            instance.breaks.all().delete()
            from daycare.services.scheduling import SchedulingService
            for b_data in breaks_data:
                b_start = b_data['break_start']
                b_end = b_data['break_end']
                SchedulingService.validate_break(instance, b_start, b_end)
                ShiftBreak.objects.create(schedule=instance, **b_data)

        return instance



class StaffScheduleCopySerializer(serializers.Serializer):
    source_start_date = serializers.DateField(required=True)
    source_end_date = serializers.DateField(required=True)
    target_start_date = serializers.DateField(required=True)
    employee_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_empty=True)
    classroom_id = serializers.UUIDField(required=False, allow_null=True)
    overwrite_conflicts = serializers.BooleanField(default=False)


class OvertimeRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    attendance_id = serializers.UUIDField(source='attendance.id', read_only=True, allow_null=True)

    class Meta:
        model = OvertimeRecord
        fields = [
            'id', 'daycare', 'employee', 'employee_name', 'employee_number',
            'attendance', 'attendance_id', 'date', 'scheduled_hours', 'actual_hours',
            'regular_hours', 'overtime_hours', 'source', 'reason',
            'status', 'approved_by', 'approved_by_name',
            'approved_at', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at', 'approved_by', 'approved_at']

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None


class TimeBankRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeBankRule
        fields = [
            'id', 'daycare', 'is_enabled', 'max_balance_hours',
            'require_approval', 'expiry_months', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']


class TimeBankTransactionSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TimeBankTransaction
        fields = [
            'id', 'daycare', 'employee', 'employee_name', 'transaction_type',
            'hours', 'date', 'reason', 'balance_after', 'approved_by',
            'approved_by_name', 'overtime_record', 'created_at'
        ]
        read_only_fields = ['id', 'daycare', 'balance_after', 'created_at', 'approved_by']

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None


class ShiftSwapRequestSerializer(serializers.ModelSerializer):
    requesting_employee_name = serializers.SerializerMethodField()
    target_employee_name = serializers.SerializerMethodField()
    requesting_shift_details = serializers.SerializerMethodField()
    target_shift_details = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ShiftSwapRequest
        fields = [
            'id', 'daycare', 'requesting_employee', 'requesting_employee_name',
            'target_employee', 'target_employee_name', 'requesting_shift',
            'requesting_shift_details', 'target_shift', 'target_shift_details',
            'reason', 'status', 'requested_at', 'approved_by',
            'approved_by_name', 'reviewed_at', 'admin_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'daycare', 'status', 'requested_at', 'approved_by',
            'reviewed_at', 'created_at', 'updated_at'
        ]

    def get_requesting_employee_name(self, obj):
        return f"{obj.requesting_employee.first_name} {obj.requesting_employee.last_name}"

    def get_target_employee_name(self, obj):
        return f"{obj.target_employee.first_name} {obj.target_employee.last_name}"

    def get_requesting_shift_details(self, obj):
        s = obj.requesting_shift
        return {
            'id': str(s.id),
            'date': str(s.date),
            'shift_start': s.shift_start.strftime('%H:%M') if s.shift_start else None,
            'shift_end': s.shift_end.strftime('%H:%M') if s.shift_end else None,
            'shift_type': s.shift_type,
            'classroom_name': s.classroom.room_name if s.classroom else 'Floating'
        }

    def get_target_shift_details(self, obj):
        if not obj.target_shift:
            return None
        s = obj.target_shift
        return {
            'id': str(s.id),
            'date': str(s.date),
            'shift_start': s.shift_start.strftime('%H:%M') if s.shift_start else None,
            'shift_end': s.shift_end.strftime('%H:%M') if s.shift_end else None,
            'shift_type': s.shift_type,
            'classroom_name': s.classroom.room_name if s.classroom else 'Floating'
        }

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = [
            'id', 'daycare', 'name', 'code', 'is_paid',
            'requires_approval', 'color_code', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    leave_type_color = serializers.CharField(source='leave_type.color_code', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    affected_shifts = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'daycare', 'employee', 'employee_name', 'employee_number',
            'leave_type', 'leave_type_name', 'leave_type_code', 'leave_type_color',
            'start_date', 'end_date', 'reason', 'notes', 'status',
            'requested_at', 'approved_by', 'approved_by_name', 'reviewed_at',
            'rejection_reason', 'affected_shifts_count', 'affected_shifts',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'daycare', 'status', 'requested_at', 'approved_by',
            'reviewed_at', 'rejection_reason', 'affected_shifts_count',
            'created_at', 'updated_at'
        ]

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}"

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None

    def get_affected_shifts(self, obj):
        from daycare.services.scheduling import LeaveService
        return LeaveService.detect_schedule_conflicts(obj.daycare, obj.employee, obj.start_date, obj.end_date)


class StaffShortageAlertSerializer(serializers.ModelSerializer):
    classroom_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffShortageAlert
        fields = [
            'id', 'daycare', 'date', 'classroom', 'classroom_name',
            'alert_level', 'required_staff', 'scheduled_staff',
            'shortage_count', 'reason', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_at', 'updated_at']

    def get_classroom_name(self, obj):
        return obj.classroom.room_name if obj.classroom else "General / Daycare-wide"


class StaffNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffNotification
        fields = [
            'id', 'daycare', 'user', 'employee', 'notification_type',
            'title', 'message', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_at']


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 1) SERIALIZERS
# ==============================================================================

from django.db import models
from core.models import (
    FeeStructure,
    ChildFeeAssignment,
    RegistrationFeeRecord,
    DepositRecord,
    DiscountRule,
    SiblingDiscountRule,
    CreditTransaction,
    LateFeeRule,
    ChildSubsidyProfile,
    TaxReceipt,
    Family
)


class FeeStructureSerializer(serializers.ModelSerializer):
    branch_name = serializers.SerializerMethodField()
    program_name = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = FeeStructure
        fields = [
            'id', 'daycare', 'branch', 'branch_name',
            'program', 'program_name', 'classroom', 'classroom_name',
            'name', 'description', 'fee_type', 'frequency',
            'amount', 'currency', 'effective_from', 'effective_until',
            'is_active', 'applies_to', 'version', 'parent_fee',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'versions_count'
        ]
        read_only_fields = ['id', 'daycare', 'version', 'parent_fee', 'created_by', 'created_at', 'updated_at']

    def get_branch_name(self, obj):
        return obj.branch.name if obj.branch else None

    def get_program_name(self, obj):
        return obj.program.name if obj.program else None

    def get_classroom_name(self, obj):
        return obj.classroom.room_name if obj.classroom else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_versions_count(self, obj):
        root = obj.parent_fee or obj
        return FeeStructure.objects.filter(models.Q(id=root.id) | models.Q(parent_fee=root)).count()

    def validate(self, attrs):
        effective_from = attrs.get('effective_from', getattr(self.instance, 'effective_from', None))
        effective_until = attrs.get('effective_until', getattr(self.instance, 'effective_until', None))
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))

        if amount is not None and amount < 0:
            raise serializers.ValidationError({"amount": "Fee amount cannot be negative."})

        if effective_from and effective_until and effective_until < effective_from:
            raise serializers.ValidationError({"effective_until": "Effective until date must be on or after effective from date."})

        return attrs


class ChildFeeAssignmentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_structure_name = serializers.SerializerMethodField()
    fee_type = serializers.SerializerMethodField()
    frequency = serializers.SerializerMethodField()
    effective_rate = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    classroom_name = serializers.SerializerMethodField()

    class Meta:
        model = ChildFeeAssignment
        fields = [
            'id', 'daycare', 'student', 'student_name',
            'enrollment', 'family', 'classroom_name',
            'fee_structure', 'fee_structure_name', 'fee_type', 'frequency',
            'custom_amount', 'discount_percentage', 'discount_reason',
            'currency', 'effective_from', 'effective_until',
            'is_active', 'notes', 'effective_rate',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'effective_rate', 'created_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else ""

    def get_fee_structure_name(self, obj):
        return obj.fee_structure.name if obj.fee_structure else ""

    def get_fee_type(self, obj):
        return obj.fee_structure.fee_type if obj.fee_structure else ""

    def get_frequency(self, obj):
        return obj.fee_structure.frequency if obj.fee_structure else ""

    def get_classroom_name(self, obj):
        if obj.enrollment and obj.enrollment.classroom:
            return obj.enrollment.classroom.room_name
        return None

    def validate(self, attrs):
        discount = attrs.get('discount_percentage', getattr(self.instance, 'discount_percentage', 0))
        if discount is not None and (discount < 0 or discount > 100):
            raise serializers.ValidationError({"discount_percentage": "Discount percentage must be between 0 and 100."})
        
        custom_amount = attrs.get('custom_amount', getattr(self.instance, 'custom_amount', None))
        if custom_amount is not None and custom_amount < 0:
            raise serializers.ValidationError({"custom_amount": "Custom amount cannot be negative."})

        return attrs


class RegistrationFeeRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_structure_name = serializers.SerializerMethodField()
    waived_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RegistrationFeeRecord
        fields = [
            'id', 'daycare', 'student', 'student_name',
            'enrollment', 'family', 'fee_structure', 'fee_structure_name',
            'amount', 'currency', 'status',
            'waived_reason', 'waived_by', 'waived_by_name', 'waived_at',
            'notes', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'created_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else ""

    def get_fee_structure_name(self, obj):
        return obj.fee_structure.name if obj.fee_structure else ""

    def get_waived_by_name(self, obj):
        if obj.waived_by:
            return f"{obj.waived_by.first_name} {obj.waived_by.last_name}".strip() or obj.waived_by.username
        return None


class DepositRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    fee_structure_name = serializers.SerializerMethodField()
    remaining_held = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DepositRecord
        fields = [
            'id', 'daycare', 'student', 'student_name',
            'enrollment', 'family', 'fee_structure', 'fee_structure_name',
            'amount_charged', 'amount_held', 'amount_applied',
            'amount_refunded', 'amount_forfeited', 'remaining_held',
            'currency', 'status', 'received_date', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'remaining_held', 'created_by', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else ""

    def get_fee_structure_name(self, obj):
        return obj.fee_structure.name if obj.fee_structure else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 2) SERIALIZERS
# ==============================================================================

class DiscountRuleSerializer(serializers.ModelSerializer):
    branch_name = serializers.SerializerMethodField()
    program_name = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = DiscountRule
        fields = [
            'id', 'daycare', 'branch', 'branch_name',
            'program', 'program_name', 'classroom', 'classroom_name',
            'family', 'family_name', 'student', 'student_name',
            'enrollment', 'name', 'description', 'discount_type',
            'value', 'currency', 'applies_to', 'target_fee_type',
            'eligibility_criteria', 'priority', 'effective_from', 'effective_until',
            'is_active', 'version', 'parent_rule',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'versions_count'
        ]
        read_only_fields = ['id', 'daycare', 'version', 'parent_rule', 'created_by', 'created_at', 'updated_at']

    def get_branch_name(self, obj):
        return obj.branch.name if obj.branch else None

    def get_program_name(self, obj):
        return obj.program.name if obj.program else None

    def get_classroom_name(self, obj):
        return obj.classroom.room_name if obj.classroom else None

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else None

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_versions_count(self, obj):
        root = obj.parent_rule or obj
        return DiscountRule.objects.filter(models.Q(id=root.id) | models.Q(parent_rule=root)).count()

    def validate(self, attrs):
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', 'PERCENTAGE'))
        value = attrs.get('value', getattr(self.instance, 'value', None))
        effective_from = attrs.get('effective_from', getattr(self.instance, 'effective_from', None))
        effective_until = attrs.get('effective_until', getattr(self.instance, 'effective_until', None))

        if value is not None:
            if value < 0:
                raise serializers.ValidationError({"value": "Discount value cannot be negative."})
            if discount_type == 'PERCENTAGE' and value > 100:
                raise serializers.ValidationError({"value": "Percentage discount value cannot exceed 100%."})

        if effective_from and effective_until and effective_until < effective_from:
            raise serializers.ValidationError({"effective_until": "Effective until date must be on or after effective from date."})

        return attrs


class SiblingDiscountRuleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = SiblingDiscountRule
        fields = [
            'id', 'daycare', 'name', 'description', 'discount_type',
            'value', 'currency', 'applies_to_target', 'target_fee_selection',
            'ordering_criteria', 'min_enrolled_siblings',
            'effective_from', 'effective_until', 'is_active',
            'version', 'parent_rule',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'versions_count'
        ]
        read_only_fields = ['id', 'daycare', 'version', 'parent_rule', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_versions_count(self, obj):
        root = obj.parent_rule or obj
        return SiblingDiscountRule.objects.filter(models.Q(id=root.id) | models.Q(parent_rule=root)).count()

    def validate(self, attrs):
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', 'PERCENTAGE'))
        value = attrs.get('value', getattr(self.instance, 'value', None))
        min_siblings = attrs.get('min_enrolled_siblings', getattr(self.instance, 'min_enrolled_siblings', 2))
        effective_from = attrs.get('effective_from', getattr(self.instance, 'effective_from', None))
        effective_until = attrs.get('effective_until', getattr(self.instance, 'effective_until', None))

        if value is not None:
            if value < 0:
                raise serializers.ValidationError({"value": "Sibling discount value cannot be negative."})
            if discount_type == 'PERCENTAGE' and value > 100:
                raise serializers.ValidationError({"value": "Percentage discount value cannot exceed 100%."})

        if min_siblings < 1:
            raise serializers.ValidationError({"min_enrolled_siblings": "Minimum enrolled siblings must be at least 1."})

        if effective_from and effective_until and effective_until < effective_from:
            raise serializers.ValidationError({"effective_until": "Effective until date must be on or after effective from date."})

        return attrs


class CreditTransactionSerializer(serializers.ModelSerializer):
    family_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CreditTransaction
        fields = [
            'id', 'daycare', 'family', 'family_name',
            'student', 'student_name', 'enrollment',
            'amount', 'currency', 'transaction_type', 'reason',
            'reference', 'notes', 'status', 'reversed_transaction',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'status', 'reversed_transaction', 'created_by', 'created_at', 'updated_at']

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else ""

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def validate(self, attrs):
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Credit transaction amount must be greater than 0."})
        return attrs


class LateFeeRuleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    versions_count = serializers.SerializerMethodField()

    class Meta:
        model = LateFeeRule
        fields = [
            'id', 'daycare', 'name', 'description', 'fee_type',
            'amount', 'currency', 'grace_period_days', 'frequency',
            'max_amount', 'effective_from', 'effective_until', 'is_active',
            'version', 'parent_rule',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'versions_count'
        ]
        read_only_fields = ['id', 'daycare', 'version', 'parent_rule', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def get_versions_count(self, obj):
        root = obj.parent_rule or obj
        return LateFeeRule.objects.filter(models.Q(id=root.id) | models.Q(parent_rule=root)).count()

    def validate(self, attrs):
        fee_type = attrs.get('fee_type', getattr(self.instance, 'fee_type', 'FIXED'))
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        grace = attrs.get('grace_period_days', getattr(self.instance, 'grace_period_days', 0))
        max_amount = attrs.get('max_amount', getattr(self.instance, 'max_amount', None))
        effective_from = attrs.get('effective_from', getattr(self.instance, 'effective_from', None))
        effective_until = attrs.get('effective_until', getattr(self.instance, 'effective_until', None))

        if amount is not None:
            if amount < 0:
                raise serializers.ValidationError({"amount": "Late fee amount cannot be negative."})
            if fee_type == 'PERCENTAGE' and amount > 100:
                raise serializers.ValidationError({"amount": "Percentage late fee rate cannot exceed 100%."})

        if grace < 0:
            raise serializers.ValidationError({"grace_period_days": "Grace period days cannot be negative."})

        if max_amount is not None and max_amount < 0:
            raise serializers.ValidationError({"max_amount": "Max amount cannot be negative."})

        if effective_from and effective_until and effective_until < effective_from:
            raise serializers.ValidationError({"effective_until": "Effective until date must be on or after effective from date."})

        return attrs


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 3) SERIALIZERS
# ==============================================================================

class InvoiceDetailSerializer(InvoiceSerializer):
    guardian_contact = serializers.SerializerMethodField()
    family_address = serializers.SerializerMethodField()

    class Meta(InvoiceSerializer.Meta):
        fields = InvoiceSerializer.Meta.fields + ['guardian_contact', 'family_address']

    def get_guardian_contact(self, obj):
        if obj.family:
            fg = obj.family.family_guardians.filter(is_primary=True).select_related('guardian').first()
            if not fg:
                fg = obj.family.family_guardians.select_related('guardian').first()
            if fg and fg.guardian:
                g = fg.guardian
                return {
                    'name': f"{g.first_name} {g.last_name}",
                    'email': g.email,
                    'phone': g.phone,
                    'relationship': fg.relationship
                }
        return None

    def get_family_address(self, obj):
        return obj.family.address if obj.family else None


class InvoiceItemInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, default=1.0)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0.0, required=False)
    discount_description = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0.0, required=False)
    fee_structure = serializers.UUIDField(required=False, allow_null=True)
    fee_type_code = serializers.CharField(max_length=50, required=False, allow_blank=True, default='CUSTOM')
    student = serializers.UUIDField(required=False, allow_null=True)
    service_period_start = serializers.DateField(required=False, allow_null=True)
    service_period_end = serializers.DateField(required=False, allow_null=True)


class InvoiceCreateSerializer(serializers.Serializer):
    family = serializers.UUIDField(required=False, allow_null=True)
    student = serializers.UUIDField(required=False, allow_null=True)
    branch = serializers.UUIDField(required=False, allow_null=True)
    invoice_type = serializers.ChoiceField(choices=Invoice.INVOICE_TYPE_CHOICES, default='STANDARD')
    issue_date = serializers.DateField(default=date.today)
    due_date = serializers.DateField()
    billing_period_start = serializers.DateField(required=False, allow_null=True)
    billing_period_end = serializers.DateField(required=False, allow_null=True)
    items = InvoiceItemInputSerializer(many=True, required=False)
    apply_credits = serializers.BooleanField(default=True)
    apply_deposits = serializers.BooleanField(default=False)
    notes = serializers.CharField(required=False, allow_blank=True, default='')


class RecurringBillingProfileSerializer(serializers.ModelSerializer):
    family_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    fee_structure_name = serializers.SerializerMethodField()
    branch_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RecurringBillingProfile
        fields = [
            'id', 'daycare', 'branch', 'branch_name',
            'family', 'family_name', 'student', 'student_name',
            'enrollment', 'fee_structure', 'fee_structure_name',
            'frequency', 'billing_day', 'billing_basis',
            'auto_apply_credits', 'auto_apply_deposits',
            'start_date', 'end_date', 'next_billing_date', 'last_billed_date',
            'is_active', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'daycare', 'last_billed_date', 'created_by', 'created_at', 'updated_at']

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else ""

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_fee_structure_name(self, obj):
        return obj.fee_structure.name if obj.fee_structure else None

    def get_branch_name(self, obj):
        return obj.branch.name if obj.branch else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return None

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        return attrs


class FamilyInvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    student_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()
    daycare_name = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'family', 'family_name',
            'student', 'student_name', 'daycare_name',
            'issue_date', 'due_date', 'billing_period_start', 'billing_period_end',
            'subtotal', 'discount_total', 'tax_total', 'late_fee_total',
            'credit_total', 'deposit_applied_total',
            'total_amount', 'amount_paid', 'balance_due', 'currency',
            'status', 'notes', 'items', 'payments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['__all__']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else ""

    def get_daycare_name(self, obj):
        return obj.daycare.name if obj.daycare else ""


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 4) SERIALIZERS
# ==============================================================================

class PaymentCreateSerializer(serializers.Serializer):
    invoice_id = serializers.UUIDField(required=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    payment_method = serializers.ChoiceField(choices=Payment.PAYMENT_METHOD_CHOICES, default='ETRANSFER')
    payment_date = serializers.DateField(required=False, default=date.today)
    transaction_reference = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    payer_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    payer_email = serializers.EmailField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        return value


class PaymentRefundSerializer(serializers.Serializer):
    refund_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default='Administrative Refund')

    def validate_refund_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Refund amount must be greater than zero.")
        return value


class ChildSubsidyProfileSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    family_name = serializers.SerializerMethodField()
    subsidy_type_display = serializers.CharField(source='get_subsidy_type_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ChildSubsidyProfile
        fields = [
            'id', 'daycare', 'student', 'student_name',
            'family', 'family_name', 'program_name',
            'subsidy_type', 'subsidy_type_display', 'subsidy_rate', 'currency',
            'government_case_number', 'parent_co_pay_amount', 'approved_days_per_week',
            'effective_from', 'effective_until', 'is_active', 'notes',
            'created_by', 'created_by_name', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else (obj.student.child_families.first().family.family_name if obj.student and obj.student.child_families.exists() else None)

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"


class TaxReceiptSerializer(serializers.ModelSerializer):
    family_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TaxReceipt
        fields = [
            'id', 'daycare', 'family', 'family_name', 'student', 'student_name',
            'tax_year', 'receipt_number',
            'recipient_name', 'recipient_address',
            'daycare_legal_name', 'daycare_business_number', 'daycare_address',
            'total_eligible_fees_paid', 'total_subsidies_deducted', 'net_claimable_amount', 'currency',
            'service_period_start', 'service_period_end', 'issued_date',
            'status', 'status_display', 'void_reason', 'notes',
            'created_by', 'created_by_name', 'updated_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_family_name(self, obj):
        return obj.family.family_name if obj.family else None

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else "All Enrolled Children"

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "System"


class TaxReceiptCreateSerializer(serializers.Serializer):
    family_id = serializers.UUIDField(required=True)
    tax_year = serializers.IntegerField(required=True, min_value=2020, max_value=2035)
    student_id = serializers.UUIDField(required=False, allow_null=True)


class TaxReceiptBatchGenerateSerializer(serializers.Serializer):
    tax_year = serializers.IntegerField(required=True, min_value=2020, max_value=2035)


class FamilyPaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    student_name = serializers.SerializerMethodField()
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    net_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'invoice_number', 'student_name',
            'receipt_number', 'amount', 'currency', 'net_amount',
            'payment_date', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'transaction_reference',
            'payer_name', 'refunded_amount', 'refund_reason',
            'notes', 'created_at'
        ]
        read_only_fields = ['__all__']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else None


class FamilyTaxReceiptSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TaxReceipt
        fields = [
            'id', 'tax_year', 'receipt_number', 'student_name',
            'recipient_name', 'recipient_address',
            'daycare_legal_name', 'daycare_business_number', 'daycare_address',
            'total_eligible_fees_paid', 'total_subsidies_deducted', 'net_claimable_amount', 'currency',
            'service_period_start', 'service_period_end', 'issued_date',
            'status', 'status_display', 'notes', 'created_at'
        ]
        read_only_fields = ['__all__']

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}" if obj.student else "All Enrolled Children"







