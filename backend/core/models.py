import uuid
import datetime
from decimal import Decimal
from django.utils import timezone
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db.models.signals import post_save
from django.dispatch import receiver

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Daycare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name='daycares')
    daycare_code = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    logo = models.CharField(max_length=2048, null=True, blank=True)
    registration_number = models.CharField(max_length=100, null=True, blank=True)
    license_number = models.CharField(max_length=100, null=True, blank=True)
    owner_name = models.CharField(max_length=255, null=True, blank=True)
    director_name = models.CharField(max_length=255, null=True, blank=True)
    contact_person = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    address1 = models.CharField(max_length=255, null=True, blank=True)
    address2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    province = models.ForeignKey('Province', on_delete=models.SET_NULL, null=True, blank=True, related_name='daycares')
    country = models.CharField(max_length=100, null=True, blank=True)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    working_days = models.JSONField(null=True, blank=True) # Assuming JSON or comma separated string
    capacity = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Inactive')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mobile = models.CharField(max_length=50, null=True, blank=True)
    profile_photo_path = models.CharField(max_length=2048, null=True, blank=True)
    terms_accepted = models.BooleanField(default=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    force_password_change = models.BooleanField(default=False)
    status = models.CharField(max_length=50, default='Active')
    
    # Optional references
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    updated_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_users')

class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    quarterly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    annual_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    trial_days = models.IntegerField(default=14)
    status = models.CharField(max_length=50, default='Active')
    max_students = models.IntegerField(default=0)
    max_teachers = models.IntegerField(default=0)
    max_staff = models.IntegerField(default=0)
    max_classrooms = models.IntegerField(default=0)
    max_branches = models.IntegerField(default=0)
    max_storage_mb = models.IntegerField(default=0)
    features = models.ManyToManyField('SubscriptionFeature', blank=True, related_name='plans')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def price(self):
        return self.monthly_price

class DaycareSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='subscriptions')
    subscription_plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    billing_cycle = models.CharField(max_length=50, default='monthly')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    start_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    trial_start_date = models.DateField(null=True, blank=True)
    trial_end_date = models.DateField(null=True, blank=True)
    subscription_status = models.CharField(max_length=50, default='Active')
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='suspended_subscriptions')
    suspension_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Employee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='employees')
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=255, null=True, blank=True)
    preferred_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    employee_number = models.CharField(max_length=100, null=True, blank=True)
    role = models.CharField(max_length=100)
    job_title = models.CharField(max_length=255, null=True, blank=True)
    employment_type = models.CharField(max_length=100, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=50, 
        default='active',
        choices=[
            ('active', 'Active'), 
            ('inactive', 'Inactive'), 
            ('on_leave', 'On Leave'), 
            ('suspended', 'Suspended'), 
            ('terminated', 'Terminated'), 
            ('archived', 'Archived')
        ]
    )
    photo = models.CharField(max_length=2048, null=True, blank=True)
    sin = models.CharField(max_length=255, null=True, blank=True)
    types = models.ManyToManyField('EmployeeType', related_name='employees', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_eligible_for_classroom(self):
        if self.status != 'active':
            return False
        if self.role and self.role.lower() in ['teacher', 'ece', 'assistant', 'educator', 'lead teacher', 'assistant teacher']:
            return True
        for et in self.types.all():
            if et.is_eligible_for_classroom or et.can_teach():
                return True
        return False

    def save(self, *args, **kwargs):
        if not self.employee_number:
            self.employee_number = f"EMP-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

class EmployeeType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='employee_types', null=True, blank=True)
    name = models.CharField(max_length=100)
    is_eligible_for_classroom = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def can_teach(self):
        if self.is_eligible_for_classroom:
            return True
        teaching_keywords = ['teacher', 'ece', 'educator', 'assistant', 'lead teacher', 'caregiver', 'childcare']
        non_teaching = ['accountant', 'receptionist', 'cook', 'cleaner', 'driver', 'janitor', 'maintenance']
        if any(nt in self.name.lower() for nt in non_teaching):
            return False
        return any(kw in self.name.lower() for kw in teaching_keywords)

class EmployeeQualification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='qualifications')
    qualification_name = models.CharField(max_length=255)
    institution = models.CharField(max_length=255)
    qualification_type = models.CharField(max_length=100)
    issue_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    document_reference = models.CharField(max_length=2048, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class EmployeeCertification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='certifications')
    certification_name = models.CharField(max_length=255)
    certification_number = models.CharField(max_length=100, null=True, blank=True)
    issuing_organization = models.CharField(max_length=255)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    document_reference = models.CharField(max_length=2048, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_active(self):
        if not self.expiry_date:
            return True
        from datetime import date
        return self.expiry_date >= date.today()

class EmployeeCompensation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='compensation_history')
    pay_type = models.CharField(max_length=50) # salary, hourly
    salary_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='CAD')
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='active')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class EmployeeDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100)
    file = models.FileField(upload_to='employee_documents/')
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='uploaded')
    notes = models.TextField(null=True, blank=True)
    uploaded_date = models.DateTimeField(auto_now_add=True)
class Province(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        default='Active',
        choices=[('Active', 'Active'), ('Inactive', 'Inactive')]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.code})"

    class Meta:
        ordering = ['name']


class CredentialType(models.Model):
    CATEGORY_CHOICES = [
        ('ece', 'ECE Credential'),
        ('certification', 'Certification'),
        ('background_check', 'Background Check'),
        ('training', 'Required Training'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=50, default='ece', choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True, null=True)
    province = models.ForeignKey(
        Province,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credential_types'
    )
    status = models.CharField(
        max_length=20,
        default='Active',
        choices=[('Active', 'Active'), ('Inactive', 'Inactive')]
    )
    requires_expiry = models.BooleanField(default=True)
    requires_certificate_number = models.BooleanField(default=True)
    default_validity_months = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        prov = f" ({self.province.code})" if self.province else ""
        return f"[{self.get_category_display()}] {self.name}{prov}"

    class Meta:
        ordering = ['category', 'name']


class ECECredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='ece_credentials'
    )
    daycare = models.ForeignKey(
        Daycare,
        on_delete=models.CASCADE,
        related_name='ece_credentials'
    )
    credential_type = models.ForeignKey(
        CredentialType,
        on_delete=models.PROTECT,
        related_name='credentials'
    )
    certificate_number = models.CharField(max_length=100, blank=True, null=True)
    issuing_organization = models.CharField(max_length=255, blank=True, null=True)
    province = models.ForeignKey(
        Province,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='credentials'
    )
    request_date = models.DateField(null=True, blank=True)
    completed_date = models.DateField(null=True, blank=True)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    document = models.FileField(upload_to='credential_documents/', null=True, blank=True)
    document_reference = models.CharField(max_length=2048, blank=True, null=True)
    document_status = models.CharField(
        max_length=50,
        default='uploaded',
        choices=[
            ('uploaded', 'Uploaded'),
            ('pending_review', 'Pending Review'),
            ('verified', 'Verified'),
            ('rejected', 'Rejected'),
            ('expired', 'Expired')
        ]
    )
    status = models.CharField(
        max_length=50,
        default='Active',
        choices=[
            ('Active', 'Active'),
            ('Expired', 'Expired'),
            ('Pending Renewal', 'Pending Renewal'),
            ('Suspended', 'Suspended'),
            ('Revoked', 'Revoked'),
            ('Inactive', 'Inactive'),
            ('Pending Review', 'Pending Review'),
            ('Requires Review', 'Requires Review'),
            ('Superseded', 'Superseded')
        ]
    )
    verification_status = models.CharField(
        max_length=50,
        default='Unverified',
        choices=[
            ('Unverified', 'Unverified'),
            ('Pending Verification', 'Pending Verification'),
            ('Verified', 'Verified'),
            ('Rejected', 'Rejected')
        ]
    )
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_credentials'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)

    previous_credential = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='renewed_credentials'
    )
    is_current = models.BooleanField(default=True)

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_expired(self):
        if not self.expiry_date:
            return False
        from datetime import date
        return self.expiry_date < date.today()

    @property
    def category(self):
        return self.credential_type.category if self.credential_type else 'ece'

    def __str__(self):
        return f"{self.employee} - {self.credential_type.name} ({self.certificate_number or 'No Cert#'})"

    class Meta:
        ordering = ['-issue_date', '-created_at']




class Student(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='students')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    admission_number = models.CharField(max_length=100, null=True, blank=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=255, null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=50, null=True, blank=True)
    language = models.CharField(max_length=100, null=True, blank=True)
    child_notes = models.TextField(null=True, blank=True)
    administrative_notes = models.TextField(null=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    photo = models.CharField(max_length=2048, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    
    # Medical Info
    allergies = models.TextField(null=True, blank=True)
    medical_conditions = models.TextField(null=True, blank=True)
    medication = models.TextField(null=True, blank=True)
    special_needs = models.TextField(null=True, blank=True)
    dietary_restrictions = models.TextField(null=True, blank=True)
    medical_notes = models.TextField(null=True, blank=True)
    doctor_name = models.CharField(max_length=255, null=True, blank=True)
    doctor_phone = models.CharField(max_length=100, null=True, blank=True)
    hospital_name = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class StudentEmergencyContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    mobile = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class StudentPickup(models.Model):
    STATUS_ACTIVE = 'ACTIVE'
    STATUS_INACTIVE = 'INACTIVE'
    STATUS_EXPIRED = 'EXPIRED'
    STATUS_REVOKED = 'REVOKED'
    STATUS_PENDING = 'PENDING_VERIFICATION'
    STATUS_PENDING_APPROVAL = 'PENDING_APPROVAL'
    STATUS_REJECTED = 'REJECTED'

    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Active'),
        (STATUS_INACTIVE, 'Inactive'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_REVOKED, 'Revoked'),
        (STATUS_PENDING, 'Pending Verification'),
        (STATUS_PENDING_APPROVAL, 'Pending Approval'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, null=True, blank=True, related_name='pickups')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='pickups')
    family = models.ForeignKey('Family', on_delete=models.SET_NULL, null=True, blank=True, related_name='pickups')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)
    photo = models.FileField(upload_to='pickup_photos/', null=True, blank=True)
    authorization_status = models.CharField(max_length=50, default='ACTIVE', choices=STATUS_CHOICES)
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    # Legacy compatibility fields
    status = models.CharField(max_length=50, default='Active') # Active/Blocked
    approval_status = models.CharField(max_length=50, default='Approved')
    id_proof_status = models.CharField(max_length=50, default='Verified')
    pending_changes = models.JSONField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_student_pickups')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_student_pickups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.student and not self.daycare_id:
            self.daycare = self.student.daycare
        from datetime import date
        if self.valid_until and self.valid_until < date.today() and self.authorization_status == self.STATUS_ACTIVE:
            self.authorization_status = self.STATUS_EXPIRED
        super().save(*args, **kwargs)

    @property
    def child(self):
        return self.student

    @property
    def person_name(self):
        return self.name

    @person_name.setter
    def person_name(self, value):
        self.name = value

    @property
    def relationship_to_child(self):
        return self.relationship

    @relationship_to_child.setter
    def relationship_to_child(self, value):
        self.relationship = value

    @property
    def is_expired(self):
        from datetime import date
        if self.authorization_status == self.STATUS_EXPIRED:
            return True
        if self.valid_until and self.valid_until < date.today():
            return True
        return False

    @property
    def is_effective(self):
        from datetime import date
        today = date.today()
        if self.authorization_status != self.STATUS_ACTIVE:
            return False
        if self.valid_from and self.valid_from > today:
            return False
        if self.valid_until and self.valid_until < today:
            return False
        return True

    def __str__(self):
        return f"{self.name} ({self.relationship}) -> {self.student.first_name} {self.student.last_name}"

    class Meta:
        ordering = ['name']

AuthorizedPickup = StudentPickup


class Announcement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='announcements')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_announcements')
    title = models.CharField(max_length=255)
    content = models.TextField()
    type = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, default='Published')
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class AnnouncementAudience(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='audiences')
    audience_type = models.CharField(max_length=100) # e.g., 'role', 'classroom', 'specific_users'
    audience_id = models.CharField(max_length=255, null=True, blank=True) # ID of the role/classroom, if applicable
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AnnouncementRead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='reads')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='read_announcements')
    read_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.get_full_name()} read {self.announcement.title}"

    class Meta:
        unique_together = ('announcement', 'user')

# ==========================================
# PROXY MODELS FOR DJANGO ADMIN GROUPING
# ==========================================
class ManagedDaycare(Daycare):
    class Meta:
        proxy = True
        verbose_name = 'Daycare Management'
        verbose_name_plural = '1. Daycare Management'

class ManagedUser(User):
    class Meta:
        proxy = True
        verbose_name = 'Platform User'
        verbose_name_plural = '2. Platform Users'

class ManagedSubscriptionPlan(SubscriptionPlan):
    class Meta:
        proxy = True
        verbose_name = 'Subscription Plan'
        verbose_name_plural = '3. Subscription Plans'

class ManagedDaycareSubscription(DaycareSubscription):
    class Meta:
        proxy = True
        verbose_name = 'Assigned Subscription'
        verbose_name_plural = '4. Assigned Subscriptions'

class Program(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    age_group = models.CharField(max_length=100, null=True, blank=True)
    min_age_months = models.IntegerField(null=True, blank=True)
    max_age_months = models.IntegerField(null=True, blank=True)
    program_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    color = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Classroom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='classrooms')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='classrooms')
    branch = models.ForeignKey('Branch', on_delete=models.CASCADE, related_name='classrooms', null=True, blank=True)
    room_name = models.CharField(max_length=255)
    room_code = models.CharField(max_length=100, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    age_group = models.ForeignKey('AgeGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='classrooms')
    capacity = models.IntegerField(null=True, blank=True)
    min_age_months = models.IntegerField(null=True, blank=True)
    max_age_months = models.IntegerField(null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    
    primary_teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='primary_classrooms')
    assistant_teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assistant_classrooms')
    staff = models.ManyToManyField(User, related_name='assigned_classrooms', blank=True)
    
    color = models.CharField(max_length=50, null=True, blank=True)
    ratio_rule = models.ForeignKey('RatioRule', on_delete=models.SET_NULL, null=True, blank=True, related_name='classrooms')
    floor = models.CharField(max_length=100, null=True, blank=True)
    building = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class ClassroomTeacherAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='teacher_assignments')
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='teacher_assignments')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='classroom_assignments')
    assignment_type = models.CharField(max_length=50) # Primary, Assistant
    status = models.CharField(max_length=50, default='Active')
    assigned_date = models.DateField(auto_now_add=True)
    end_date = models.DateField(null=True, blank=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_teacher_assignments')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_teacher_assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class ClassroomStudent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='classroom_enrollments')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('classroom', 'student')

Enrollment = ClassroomStudent
ChildEnrollment = ClassroomStudent

class StudentAttendance(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('EXCUSED_ABSENCE', 'Excused Absence'),
        ('LATE', 'Late'),
        ('EARLY_PICKUP', 'Early Pickup'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='attendances')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendances')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances')
    
    attendance_date = models.DateField()
    attendance_status = models.CharField(max_length=50, default='PRESENT') # PRESENT, ABSENT, EXCUSED_ABSENCE, LATE, EARLY_PICKUP
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    expected_arrival_time = models.TimeField(null=True, blank=True)
    expected_departure_time = models.TimeField(null=True, blank=True)
    
    arrival_type = models.CharField(max_length=50, null=True, blank=True, default='STANDARD')
    departure_type = models.CharField(max_length=50, null=True, blank=True, default='STANDARD')
    is_late = models.BooleanField(default=False)
    is_early_pickup = models.BooleanField(default=False)
    late_reason = models.CharField(max_length=255, null=True, blank=True)
    early_pickup_reason = models.CharField(max_length=255, null=True, blank=True)
    
    received_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_students')
    released_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='released_students')
    pickup_person = models.ForeignKey(StudentPickup, on_delete=models.SET_NULL, null=True, blank=True, related_name='pickups_made')
    
    remarks = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    # Phase 2: Corrections and Excused Absences
    is_corrected = models.BooleanField(default=False)
    correction_reason = models.TextField(null=True, blank=True)
    corrected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='corrected_attendances')
    corrected_at = models.DateTimeField(null=True, blank=True)
    excused_reason_type = models.CharField(max_length=100, null=True, blank=True) # MEDICAL, FAMILY_APPROVED, PLANNED, ILLNESS, OTHER
    supporting_document = models.ForeignKey('Document', on_delete=models.SET_NULL, null=True, blank=True, related_name='excused_attendances')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_attendances')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_attendances')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('student', 'attendance_date')
        ordering = ['-attendance_date', '-created_at']


class PickupQRToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='pickup_qr_tokens')
    pickup_person = models.ForeignKey(StudentPickup, on_delete=models.CASCADE, related_name='qr_tokens')
    token = models.CharField(max_length=128, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='revoked_qr_tokens')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_valid(self):
        if not self.is_active or self.revoked_at is not None:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    def __str__(self):
        return f"QR Token for {self.pickup_person.name} ({self.daycare.name})"


class PickupSecurityPIN(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='pickup_pins')
    pickup_person = models.OneToOneField(StudentPickup, on_delete=models.CASCADE, related_name='security_pin')
    pin_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    failed_attempts_count = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_locked(self):
        if self.locked_until and self.locked_until > timezone.now():
            return True
        return False

    def check_pin(self, raw_pin: str) -> bool:
        from django.contrib.auth.hashers import check_password
        return check_password(raw_pin, self.pin_hash)

    def __str__(self):
        return f"PIN Security for {self.pickup_person.name}"


class SafeArrivalDepartureEvent(models.Model):
    EVENT_CHECK_IN = 'CHECK_IN'
    EVENT_CHECK_OUT = 'CHECK_OUT'
    EVENT_LATE_PICKUP = 'LATE_PICKUP'
    EVENT_UNAUTHORIZED_ATTEMPT = 'UNAUTHORIZED_ATTEMPT'
    EVENT_VERIFICATION_FAILED = 'VERIFICATION_FAILED'

    EVENT_TYPE_CHOICES = [
        (EVENT_CHECK_IN, 'Check In'),
        (EVENT_CHECK_OUT, 'Check Out'),
        (EVENT_LATE_PICKUP, 'Late Pickup'),
        (EVENT_UNAUTHORIZED_ATTEMPT, 'Unauthorized Attempt'),
        (EVENT_VERIFICATION_FAILED, 'Verification Failed'),
    ]

    METHOD_MANUAL = 'MANUAL'
    METHOD_QR = 'QR'
    METHOD_PIN = 'PIN'
    METHOD_DIGITAL_SIGNATURE = 'DIGITAL_SIGNATURE'

    METHOD_CHOICES = [
        (METHOD_MANUAL, 'Manual'),
        (METHOD_QR, 'QR Code'),
        (METHOD_PIN, 'PIN'),
        (METHOD_DIGITAL_SIGNATURE, 'Digital Signature'),
    ]

    STATUS_SUCCESS = 'SUCCESS'
    STATUS_FAILED = 'FAILED'

    STATUS_CHOICES = [
        (STATUS_SUCCESS, 'Success'),
        (STATUS_FAILED, 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='arrival_departure_events')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='arrival_departure_events')
    authorized_pickup = models.ForeignKey(StudentPickup, on_delete=models.SET_NULL, null=True, blank=True, related_name='arrival_departure_events')
    attendance_record = models.ForeignKey(StudentAttendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='arrival_departure_events')
    
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES)
    verification_method = models.CharField(max_length=50, choices=METHOD_CHOICES, default=METHOD_MANUAL)
    verification_status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_SUCCESS)
    failure_reason = models.TextField(null=True, blank=True)
    
    is_late_pickup = models.BooleanField(default=False)
    expected_pickup_time = models.TimeField(null=True, blank=True)
    actual_checkout_time = models.TimeField(null=True, blank=True)
    late_duration_minutes = models.IntegerField(default=0)
    attempted_person_name = models.CharField(max_length=255, null=True, blank=True)

    timestamp = models.DateTimeField(default=timezone.now)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_arrival_departure_events')
    
    signature_data = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    device_metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp', '-created_at']

    def __str__(self):
        return f"{self.event_type} ({self.verification_method}) - {self.student.first_name} at {self.timestamp}"


PickupEvent = SafeArrivalDepartureEvent


class DailyReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='daily_reports')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='daily_reports')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    attendance_record = models.ForeignKey(StudentAttendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    
    report_date = models.DateField()
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_reports')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_daily_reports')
    status = models.CharField(max_length=50, default='Draft') # Draft, Completed, Published, Shared, Archived
    notes = models.TextField(null=True, blank=True)
    
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('student', 'report_date')
        ordering = ['-report_date', '-created_at']

    @property
    def child(self):
        return self.student

    @property
    def created_by(self):
        return self.teacher

DailyChildReport = DailyReport


class MealRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='meals')
    meal_type = models.CharField(max_length=100) # Breakfast, AM Snack, Lunch, PM Snack, Late Snack, Dinner, Other
    meal_category = models.CharField(max_length=50, default='Meal') # Meal, Snack
    food_provided = models.TextField(null=True, blank=True) # Food/items provided
    amount_eaten = models.CharField(max_length=50, null=True, blank=True) # None, Some, Most, All, Little
    time = models.TimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_meals')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time', 'recorded_at']


class NapRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='naps')
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    quality = models.CharField(max_length=50, null=True, blank=True) # Slept, Rested, Restless, Did Not Sleep
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_naps')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time', 'recorded_at']


class ToiletingRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='toileting')
    type = models.CharField(max_length=50) # Diaper, Potty, Accident
    condition = models.CharField(max_length=50, null=True, blank=True) # Wet, BM, Dry, Mixed, Clean
    assistance_level = models.CharField(max_length=50, null=True, blank=True) # Independent, Prompted, Assisted, Full Assistance
    time = models.TimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_toileting')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time', 'recorded_at']


class ActivityRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=100) # General Activity, Learning & Development, Outdoor Play, Sensory, Creative Arts, Music, Circle Time, STEM, Other
    activity_category = models.CharField(max_length=100, default='General Activity')
    name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    teacher_notes = models.TextField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    learning_area = models.CharField(max_length=100, null=True, blank=True) # Cognitive, Physical, Fine Motor, Social-Emotional, Language & Literacy, Math & Science, Creative Expression
    participation = models.CharField(max_length=50, null=True, blank=True) # High, Medium, Low, Observed
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_activities')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_time', 'recorded_at']


class MoodRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='moods')
    mood = models.CharField(max_length=50) # Happy, Calm, Excited, Tired, Sad, Upset, Playful, Other
    time = models.TimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_moods')
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time', 'recorded_at']


class DailyTemperatureRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='temperatures')
    temperature_value = models.DecimalField(max_digits=5, decimal_places=2)
    unit = models.CharField(max_length=20, default='Celsius') # Celsius, Fahrenheit
    time = models.TimeField(null=True, blank=True)
    method = models.CharField(max_length=50, default='Forehead') # Forehead, Ear, Armpit, Oral, Other
    notes = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_temperatures')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['time', 'created_at']


class DailyNoteRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='staff_notes')
    time = models.TimeField(null=True, blank=True)
    category = models.CharField(max_length=50, default='General') # General, Health, Behavior, Reminder, Supplies Needed, Other
    note_text = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_daily_notes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['time', 'created_at']


class DailyPhotoRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='photos')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='daily_photos')
    file_path = models.FileField(upload_to='daily_photos/', null=True, blank=True)
    photo_url = models.CharField(max_length=2048, null=True, blank=True)
    caption = models.CharField(max_length=255, null=True, blank=True)
    activity_context = models.CharField(max_length=100, null=True, blank=True)
    file_size = models.BigIntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_daily_photos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class FeeType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='fee_types')
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=50, default='One-time') # One-time, Weekly, Monthly, Yearly
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Invoice(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('VOID', 'Void'),
        ('CANCELLED', 'Cancelled'),
    ]

    INVOICE_TYPE_CHOICES = [
        ('STANDARD', 'Standard Childcare Invoice'),
        ('REGISTRATION', 'Registration Fee Invoice'),
        ('RECURRING', 'Recurring Cycle Invoice'),
        ('DEPOSIT', 'Deposit Charge Invoice'),
        ('AD_HOC', 'Ad-Hoc / Custom Invoice'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='invoices')
    family = models.ForeignKey('Family', on_delete=models.CASCADE, null=True, blank=True, related_name='invoices')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    branch = models.ForeignKey('Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    enrollment = models.ForeignKey('ClassroomStudent', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    invoice_number = models.CharField(max_length=100, unique=True, db_index=True)
    invoice_type = models.CharField(max_length=50, choices=INVOICE_TYPE_CHOICES, default='STANDARD')
    
    billing_period_start = models.DateField(null=True, blank=True)
    billing_period_end = models.DateField(null=True, blank=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # Legacy alias
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00')) # Legacy alias
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    late_fee_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    credit_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    deposit_applied_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='CAD')
    
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='DRAFT')
    void_reason = models.TextField(null=True, blank=True)
    cancelled_reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    terms = models.TextField(null=True, blank=True)
    
    recurring_profile = models.ForeignKey('RecurringBillingProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    updated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_invoices')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']
        indexes = [
            models.Index(fields=['daycare', 'status']),
            models.Index(fields=['family', 'status']),
            models.Index(fields=['issue_date', 'due_date']),
        ]

    def __str__(self):
        target = f"{self.student.first_name} {self.student.last_name}" if self.student else (self.family.family_name if self.family else "Daycare Client")
        return f"Invoice {self.invoice_number} - {target} ({self.total_amount} {self.currency}, {self.status})"

    @property
    def total(self):
        return self.total_amount

    def recalculate_totals(self, save=True):
        from daycare.services.billing import quantize_money
        
        base_items = [item for item in self.items.all() if getattr(item, 'fee_type_code', '') != 'LATE_FEE']
        late_fee_items = [item for item in self.items.all() if getattr(item, 'fee_type_code', '') == 'LATE_FEE']
        
        subtotal = sum((Decimal(str(item.subtotal or '0.00')) for item in base_items), Decimal('0.00'))
        line_discounts = sum((Decimal(str(item.discount_amount or '0.00')) for item in base_items), Decimal('0.00'))
        line_taxes = sum((Decimal(str(item.tax_amount or '0.00')) for item in base_items), Decimal('0.00'))
        
        self.subtotal = quantize_money(subtotal)
        self.discount_total = quantize_money(line_discounts)
        self.discount = self.discount_total
        self.tax_total = quantize_money(line_taxes)
        self.tax = self.tax_total
        
        if late_fee_items:
            late_fee = sum((Decimal(str(item.total or item.subtotal or '0.00')) for item in late_fee_items), Decimal('0.00'))
            self.late_fee_total = quantize_money(late_fee)
        else:
            late_fee = Decimal(str(self.late_fee_total or '0.00'))
            
        tax_total = Decimal(str(self.tax_total or '0.00'))
        amount_paid = Decimal(str(self.amount_paid or '0.00'))
        credit_total = Decimal(str(self.credit_total or '0.00'))
        deposit_applied = Decimal(str(self.deposit_applied_total or '0.00'))
        
        self.total_amount = quantize_money(max(Decimal('0.00'), self.subtotal - self.discount_total + late_fee + tax_total))
        self.balance_due = quantize_money(max(Decimal('0.00'), self.total_amount - amount_paid - credit_total - deposit_applied))
        
        if self.status not in ['VOID', 'CANCELLED']:
            if self.balance_due == Decimal('0.00') and self.total_amount > Decimal('0.00'):
                self.status = 'PAID'
            elif amount_paid > Decimal('0.00') or credit_total > Decimal('0.00') or deposit_applied > Decimal('0.00'):
                self.status = 'PARTIALLY_PAID'
            elif (self.due_date and self.due_date < timezone.now().date()) or late_fee > Decimal('0.00'):
                if self.status != 'DRAFT':
                    self.status = 'OVERDUE'
            else:
                if self.status != 'DRAFT':
                    self.status = 'ISSUED'
                
        if save:
            self.save()


class InvoiceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    fee_type = models.ForeignKey(FeeType, on_delete=models.SET_NULL, null=True, blank=True)
    fee_structure = models.ForeignKey('FeeStructure', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice_items')
    fee_type_code = models.CharField(max_length=50, blank=True, default='')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice_items')
    enrollment = models.ForeignKey('ClassroomStudent', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice_items')
    
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_description = models.CharField(max_length=255, blank=True, default='')
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    service_period_start = models.DateField(null=True, blank=True)
    service_period_end = models.DateField(null=True, blank=True)
    attendance_basis_meta = models.JSONField(default=dict, blank=True)
    rate_snapshot = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price} = {self.total})"

    def save(self, *args, **kwargs):
        from daycare.services.billing import quantize_money
        
        qty = Decimal(str(self.quantity if self.quantity is not None else '1.00'))
        price = Decimal(str(self.unit_price if self.unit_price is not None else '0.00'))
        disc = Decimal(str(self.discount_amount if self.discount_amount is not None else '0.00'))
        tax = Decimal(str(self.tax_amount if self.tax_amount is not None else '0.00'))
        
        if self.subtotal is None or self.subtotal == Decimal('0.00'):
            self.subtotal = quantize_money(qty * price)
        else:
            self.subtotal = quantize_money(Decimal(str(self.subtotal)))
            
        if self.total is None or self.total == Decimal('0.00'):
            self.total = quantize_money(max(Decimal('0.00'), self.subtotal - disc + tax))
        else:
            self.total = quantize_money(Decimal(str(self.total)))
            
        if not self.rate_snapshot and self.unit_price is not None:
            self.rate_snapshot = {
                'unit_price': str(self.unit_price),
                'fee_name': self.fee_structure.name if self.fee_structure else self.description,
                'fee_type': self.fee_type_code or (self.fee_structure.fee_type if self.fee_structure else 'CUSTOM'),
                'subtotal': str(self.subtotal),
                'discount_amount': str(self.discount_amount),
                'tax_amount': str(self.tax_amount),
                'total': str(self.total)
            }
        super().save(*args, **kwargs)


InvoiceLineItem = InvoiceItem


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('ETRANSFER', 'Interac e-Transfer'),
        ('CREDIT_CARD', 'Credit Card'),
        ('DEBIT_CARD', 'Debit / POS'),
        ('CHEQUE', 'Cheque'),
        ('BANK_TRANSFER', 'Direct Bank Transfer / ACH / EFT'),
        ('SUBSIDY_DIRECT', 'Direct Government Subsidy Remittance'),
        ('OTHER', 'Other / Manual'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('COMPLETED', 'Completed / Cleared'),
        ('PENDING', 'Pending Verification'),
        ('FAILED', 'Failed / Declined'),
        ('REFUNDED', 'Fully Refunded'),
        ('PARTIALLY_REFUNDED', 'Partially Refunded'),
        ('BOUNCED', 'Bounced / NSF'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='payments')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    family = models.ForeignKey('Family', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, null=True, blank=True, related_name='payments')

    receipt_number = models.CharField(max_length=64, unique=True, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=100, choices=PAYMENT_METHOD_CHOICES, default='ETRANSFER')
    status = models.CharField(max_length=50, choices=PAYMENT_STATUS_CHOICES, default='COMPLETED')

    transaction_reference = models.CharField(max_length=255, null=True, blank=True)
    payer_name = models.CharField(max_length=255, null=True, blank=True)
    payer_email = models.CharField(max_length=255, null=True, blank=True)

    refunded_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    refund_reason = models.TextField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_payments')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_payments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']
        indexes = [
            models.Index(fields=['daycare', 'payment_date']),
            models.Index(fields=['invoice', 'status']),
            models.Index(fields=['receipt_number']),
            models.Index(fields=['family', 'payment_date']),
        ]

    def __str__(self):
        rcp = f" [{self.receipt_number}]" if self.receipt_number else ""
        return f"Payment: {self.amount} {self.currency} for Invoice {self.invoice.invoice_number}{rcp} ({self.status})"

    @property
    def net_amount(self):
        from decimal import Decimal
        return max(Decimal('0.00'), Decimal(str(self.amount)) - Decimal(str(self.refunded_amount)))


class HealthProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='health_profiles')
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='health_profile')
    
    blood_type = models.CharField(max_length=10, null=True, blank=True)
    ohip_number = models.CharField(max_length=50, null=True, blank=True)
    primary_physician = models.CharField(max_length=255, null=True, blank=True)
    clinic = models.CharField(max_length=255, null=True, blank=True)
    dentist = models.CharField(max_length=255, null=True, blank=True)
    hospital_preference = models.CharField(max_length=255, null=True, blank=True)
    emergency_medical_consent = models.BooleanField(default=False)
    special_needs = models.TextField(null=True, blank=True)
    health_notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Allergy(models.Model):
    ALLERGY_TYPES = (
        ('Food', 'Food'),
        ('Medication', 'Medication'),
        ('Environmental', 'Environmental'),
        ('Other', 'Other'),
    )
    SEVERITY_CHOICES = (
        ('Mild', 'Mild'),
        ('Moderate', 'Moderate'),
        ('Severe', 'Severe'),
        ('Anaphylactic', 'Anaphylactic'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='allergy_records')
    
    type = models.CharField(max_length=50, choices=ALLERGY_TYPES)
    allergen = models.CharField(max_length=255)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES)
    symptoms = models.TextField(null=True, blank=True)
    emergency_response = models.TextField(null=True, blank=True)
    epipen_required = models.BooleanField(default=False)
    expiry_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Medication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='medication_records')
    
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    route = models.CharField(max_length=100, null=True, blank=True)
    frequency = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    prescribing_doctor = models.CharField(max_length=255, null=True, blank=True)
    parent_consent = models.BooleanField(default=False)
    storage_location = models.CharField(max_length=255, null=True, blank=True)
    special_instructions = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MedicationAdministration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name='administrations')
    administered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='administered_medications')
    witness = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='witnessed_medications')
    
    date = models.DateField()
    time = models.TimeField()
    dosage_given = models.CharField(max_length=100, null=True, blank=True)
    outcome = models.CharField(max_length=255, null=True, blank=True)
    missed_dose = models.BooleanField(default=False)
    reason = models.CharField(max_length=255, null=True, blank=True)
    teacher_notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    color = models.CharField(max_length=50, null=True, blank=True)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentFolder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='folders')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subfolders')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='documents')
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True)
    folder = models.ForeignKey(DocumentFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    file_path = models.FileField(upload_to='documents/')
    file_type = models.CharField(max_length=100, null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    
    # Generic relations to associate with Student or Employee
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.UUIDField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    status = models.CharField(max_length=50, default='active')
    visibility = models.CharField(max_length=50, default='private')
    
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentExpiration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='expiration')
    expiry_date = models.DateField()
    reminder_sent = models.BooleanField(default=False)
    reminder_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class IncidentReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='incident_reports')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='incident_reports')
    reporting_employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='reported_incidents')
    
    activity_date = models.DateField()
    time = models.TimeField()
    incident_type = models.CharField(max_length=100) # Fall, Injury, Bite, Allergy, Illness, Behaviour
    description = models.TextField()
    action_taken = models.TextField()
    witness = models.CharField(max_length=255, null=True, blank=True)
    follow_up_required = models.BooleanField(default=False)
    severity = models.CharField(max_length=50) # Low, Medium, High, Emergency
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class InspectionVisit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='inspections')
    inspection_date = models.DateField()
    inspector_name = models.CharField(max_length=255)
    inspection_type = models.CharField(max_length=100) # Routine, Unannounced, Complaint
    pass_fail = models.CharField(max_length=50, null=True, blank=True)
    recommendations = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class InspectionFinding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection_visit = models.ForeignKey(InspectionVisit, on_delete=models.CASCADE, related_name='findings')
    status = models.CharField(max_length=50) # Compliant, Non-Compliant, Observation
    description = models.TextField()
    severity = models.CharField(max_length=50, default='Low') # Low, Medium, High, Critical
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CorrectiveAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='corrective_actions')
    inspection_finding = models.ForeignKey(InspectionFinding, on_delete=models.CASCADE, null=True, blank=True, related_name='actions')
    task = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_corrective_actions')
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=50, default='Medium') # Low, Medium, High, Critical
    completion_status = models.CharField(max_length=50, default='Open') # Open, In Progress, Completed, Verified
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AgeGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='age_groups')
    name = models.CharField(max_length=255)
    min_age_months = models.IntegerField()
    max_age_months = models.IntegerField()
    description = models.TextField(null=True, blank=True)
    color_label = models.CharField(max_length=50, null=True, blank=True)
    display_order = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default='Active')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_age_groups')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_age_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('daycare', 'name')
        ordering = ['display_order', 'min_age_months']

@receiver(post_save, sender=Daycare)
def seed_default_age_groups(sender, instance, created, **kwargs):
    if created:
        defaults = [
            {'name': 'Infant', 'min_age_months': 0, 'max_age_months': 12, 'display_order': 1},
            {'name': 'Toddler', 'min_age_months': 13, 'max_age_months': 24, 'display_order': 2},
            {'name': 'Preschool', 'min_age_months': 25, 'max_age_months': 36, 'display_order': 3},
            {'name': 'Nursery', 'min_age_months': 37, 'max_age_months': 48, 'display_order': 4},
            {'name': 'Pre-K', 'min_age_months': 49, 'max_age_months': 60, 'display_order': 5},
            {'name': 'Kindergarten', 'min_age_months': 61, 'max_age_months': 72, 'display_order': 6},
        ]
        for idx, item in enumerate(defaults):
            AgeGroup.objects.create(
                daycare=instance,
                name=item['name'],
                min_age_months=item['min_age_months'],
                max_age_months=item['max_age_months'],
                display_order=item['display_order']
            )

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_type = models.CharField(max_length=50, blank=True, null=True)
    action = models.CharField(max_length=255)
    module = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=255)
    entity_id = models.CharField(max_length=255)
    old_values = models.JSONField(blank=True, null=True)
    new_values = models.JSONField(blank=True, null=True)
    ip_address = models.CharField(max_length=39, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', models.CASCADE, blank=True, null=True)


class ChildEnrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_date = models.DateField(blank=True, null=True)
    enrollment_date = models.DateField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50)
    withdrawal_reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    student = models.ForeignKey('Student', models.CASCADE)
    application = models.ForeignKey('Registrationapplication', models.CASCADE, blank=True, null=True)


class ChildVaccinationRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vaccine_name = models.CharField(max_length=255)
    dose = models.CharField(max_length=50)
    vaccination_date = models.DateField()
    provider = models.CharField(max_length=255, blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Active')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    document = models.ForeignKey('Document', models.CASCADE, blank=True, null=True)
    student = models.ForeignKey('Student', models.CASCADE)



class ClassroomStaff(models.Model):
    classroom = models.ForeignKey('Classroom', models.CASCADE)
    user = models.ForeignKey('User', models.CASCADE)


class ConsentForm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    content = models.TextField()
    form_type = models.CharField(max_length=50)
    requires_signature = models.BooleanField()
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    version = models.IntegerField()


class ConsentFormAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=50)
    due_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    assigned_by = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    consent_form = models.ForeignKey('Consentform', models.CASCADE)
    family = models.ForeignKey('Family', models.CASCADE, blank=True, null=True)
    student = models.ForeignKey('Student', models.CASCADE)


class ConsentFormSignature(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    signature_name = models.CharField(max_length=255)
    ip_address = models.CharField(max_length=39, blank=True, null=True)
    agreement_text = models.TextField()
    signed_at = models.DateTimeField()
    created_at = models.DateTimeField()
    assignment = models.OneToOneField('Consentformassignment', models.CASCADE)
    signed_by = models.ForeignKey('User', models.CASCADE)


class DaycareEmergencyInformation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contact_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=100)
    alternate_phone = models.CharField(max_length=100, blank=True, null=True)
    email = models.CharField(max_length=254, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    police_contact = models.CharField(max_length=100, blank=True, null=True)
    fire_service_contact = models.CharField(max_length=100, blank=True, null=True)
    hospital_contact = models.CharField(max_length=100, blank=True, null=True)
    additional_instructions = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    daycare = models.OneToOneField('Daycare', models.CASCADE)


class DaycareHoliday(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    holiday_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Active')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    daycare = models.ForeignKey('Daycare', models.CASCADE)


class DaycareLicense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_type = models.CharField(max_length=100, blank=True, null=True)
    issuing_authority = models.CharField(max_length=255, blank=True, null=True)
    issue_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Active')
    document_path = models.CharField(max_length=2048, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    daycare = models.OneToOneField('Daycare', models.CASCADE)
    license_number = models.CharField(max_length=100, blank=True, null=True)


class DaycareSettings(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timezone = models.CharField(max_length=50)
    date_format = models.CharField(max_length=20)
    time_format = models.CharField(max_length=20)
    currency = models.CharField(max_length=10)
    default_language = models.CharField(max_length=10)
    week_start_day = models.CharField(max_length=15)
    default_operating_start = models.TimeField(blank=True, null=True)
    default_operating_end = models.TimeField(blank=True, null=True)
    allow_parent_notifications = models.BooleanField()
    allow_staff_notifications = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.OneToOneField('Daycare', models.CASCADE)


class EnrollmentForm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    version = models.IntegerField()
    is_required = models.BooleanField()
    is_active = models.BooleanField()
    fields_schema = models.JSONField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey('Daycare', models.CASCADE)


class Family(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    family_name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default='Active')
    primary_contact = models.CharField(max_length=255, blank=True, null=True)
    primary_email = models.CharField(max_length=254, blank=True, null=True)
    primary_phone = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    secondary_phone = models.CharField(max_length=100, blank=True, null=True)


class FamilyAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    family = models.ForeignKey('Family', models.CASCADE)


class FamilyChild(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    family = models.ForeignKey('Family', models.CASCADE, related_name='family_children')
    student = models.ForeignKey('Student', models.CASCADE, related_name='child_families')


class FamilyGuardian(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    relationship = models.CharField(max_length=100, default='Guardian')
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    family = models.ForeignKey('Family', models.CASCADE, related_name='family_guardians')
    guardian = models.ForeignKey('Guardian', models.CASCADE, related_name='guardian_families')
    status = models.CharField(max_length=50, default='Active')




class FamilyMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    message_type = models.CharField(max_length=50)
    is_read = models.BooleanField()
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    family = models.ForeignKey('Family', models.CASCADE)
    parent_message = models.ForeignKey('self', models.CASCADE, blank=True, null=True)
    recipient = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    sender = models.ForeignKey('User', models.CASCADE, related_name='corefamilymessage_sender_set')


class Guardian(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=255, blank=True, null=True)
    email = models.CharField(unique=True, max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=50, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    user = models.OneToOneField('User', models.CASCADE, blank=True, null=True, related_name='guardian_profile')



class GuardianCommunicationPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email_alerts = models.BooleanField(default=True)
    sms_alerts = models.BooleanField(default=False)
    emergency_alerts_only = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    guardian = models.OneToOneField('Guardian', models.CASCADE, related_name='communication_preference')



class GuardianInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.CharField(max_length=254)
    relationship = models.CharField(max_length=100)
    token = models.CharField(unique=True, max_length=255)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    updated_at = models.DateTimeField(default=timezone.now)
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    invited_by = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    student = models.ForeignKey('Student', models.CASCADE)

    def is_expired(self):
        from django.utils import timezone
        return bool(self.expires_at and self.expires_at < timezone.now())


class GuardianPasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.CharField(unique=True, max_length=255)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    user = models.ForeignKey('User', models.CASCADE)

    def is_valid(self):
        from django.utils import timezone
        return not self.used and self.expires_at > timezone.now()


class RegistrationApplication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application_number = models.CharField(unique=True, max_length=100)
    applicant_name = models.CharField(max_length=255)
    applicant_email = models.CharField(max_length=254)
    applicant_phone = models.CharField(max_length=50)
    status = models.CharField(max_length=50, default='draft')
    submitted_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    access_token = models.CharField(max_length=32, blank=True, default='')
    application_data = models.JSONField(default=dict, blank=True)


class StaffAttendance(models.Model):
    STATUS_CHOICES = [
        ('CLOCKED_IN', 'Clocked In'),
        ('ON_BREAK', 'On Break'),
        ('CLOCKED_OUT', 'Clocked Out'),
        ('ABSENT', 'Absent'),
        ('EXCUSED', 'Excused Absence'),
        ('AUTO_CLOSED', 'Auto Closed'),
    ]
    APPROVAL_CHOICES = [
        ('DRAFT', 'Draft'),
        ('SUBMITTED', 'Submitted for Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CORRECTION_REQUIRED', 'Correction Required'),
        ('PENDING', 'Pending Approval'),
        ('CORRECTED', 'Corrected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='staff_attendances', null=True, blank=True)
    branch = models.ForeignKey('Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_attendances')
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='staff_attendances')
    classroom = models.ForeignKey('Classroom', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_attendances')
    scheduled_shift = models.ForeignKey('StaffSchedule', on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances')
    
    date = models.DateField()
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    check_in_time = models.TimeField(blank=True, null=True)
    check_out_time = models.TimeField(blank=True, null=True)
    
    status = models.CharField(max_length=50, default='CLOCKED_IN')
    approval_status = models.CharField(max_length=50, default='PENDING', choices=APPROVAL_CHOICES)
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_staff_attendances')
    approved_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_staff_attendances')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    logged_by = models.ForeignKey('User', on_delete=models.SET_NULL, blank=True, null=True, related_name='logged_staff_attendances')
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_staff_attendances')
    updated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_staff_attendances')
    
    is_corrected = models.BooleanField(default=False)
    correction_reason = models.TextField(null=True, blank=True)
    corrected_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='corrected_staff_attendances')
    corrected_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-clock_in']
        indexes = [
            models.Index(fields=['daycare', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.employee.first_name} {self.employee.last_name} - {self.date} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.daycare_id and self.employee_id and hasattr(self.employee, 'daycare_id'):
            self.daycare_id = self.employee.daycare_id
        super().save(*args, **kwargs)

    @property
    def total_duration_hours(self):
        if self.clock_in and self.clock_out:
            seconds = (self.clock_out - self.clock_in).total_seconds()
            return round(max(0.0, seconds / 3600.0), 2)
        elif self.check_in_time and self.check_out_time and self.date:
            from datetime import datetime
            s_dt = datetime.combine(self.date, self.check_in_time)
            e_dt = datetime.combine(self.date, self.check_out_time)
            seconds = (e_dt - s_dt).total_seconds()
            return round(max(0.0, seconds / 3600.0), 2)
        return 0.0

    @property
    def total_unpaid_break_hours(self):
        if not self.pk:
            return 0.0
        unpaid = self.breaks.filter(is_paid=False, break_end__isnull=False)
        total_sec = sum([(b.break_end - b.break_start).total_seconds() for b in unpaid if b.break_start and b.break_end])
        return round(max(0.0, total_sec / 3600.0), 2)

    @property
    def total_paid_break_hours(self):
        if not self.pk:
            return 0.0
        paid = self.breaks.filter(is_paid=True, break_end__isnull=False)
        total_sec = sum([(b.break_end - b.break_start).total_seconds() for b in paid if b.break_start and b.break_end])
        return round(max(0.0, total_sec / 3600.0), 2)

    @property
    def total_break_hours(self):
        return round(self.total_unpaid_break_hours + self.total_paid_break_hours, 2)

    @property
    def total_break_minutes(self):
        if not self.pk:
            return 0
        all_breaks = self.breaks.filter(break_end__isnull=False)
        total_sec = sum([(b.break_end - b.break_start).total_seconds() for b in all_breaks if b.break_start and b.break_end])
        return int(round(total_sec / 60.0))

    @property
    def actual_working_hours(self):
        dur = self.total_duration_hours
        unpaid = self.total_unpaid_break_hours
        return max(0.0, round(dur - unpaid, 2))

    @property
    def scheduled_hours(self):
        if self.scheduled_shift:
            return self.scheduled_shift.net_working_hours
        return 0.0

    @property
    def variance_minutes(self):
        if not self.scheduled_shift or not self.clock_out:
            return 0
        actual_min = int(round(self.actual_working_hours * 60))
        sched_min = int(round(self.scheduled_shift.net_working_hours * 60))
        return actual_min - sched_min

    @property
    def is_late(self):
        if self.scheduled_shift and self.scheduled_shift.shift_start and self.clock_in:
            c_time = self.clock_in.time() if hasattr(self.clock_in, 'time') else self.clock_in
            return c_time > self.scheduled_shift.shift_start
        return False

    @property
    def is_early_departure(self):
        if self.scheduled_shift and self.scheduled_shift.shift_end and self.clock_out:
            c_time = self.clock_out.time() if hasattr(self.clock_out, 'time') else self.clock_out
            return c_time < self.scheduled_shift.shift_end
        return False


class StaffBreak(models.Model):
    BREAK_TYPES = [
        ('MEAL', 'Meal Break'),
        ('REST', 'Rest Break'),
        ('OTHER', 'Other Break'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey(
        StaffAttendance,
        on_delete=models.CASCADE,
        related_name='breaks'
    )
    break_start = models.DateTimeField()
    break_end = models.DateTimeField(null=True, blank=True)
    break_type = models.CharField(max_length=50, default='MEAL', choices=BREAK_TYPES)
    is_paid = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['break_start']
        indexes = [
            models.Index(fields=['attendance', 'break_start']),
        ]

    def __str__(self):
        return f"Break ({self.break_type}) for Attendance {self.attendance_id} at {self.break_start}"

    @property
    def duration_minutes(self):
        if self.break_start and self.break_end:
            return int(round((self.break_end - self.break_start).total_seconds() / 60.0))
        return 0

    @property
    def duration_hours(self):
        if self.break_start and self.break_end:
            return round((self.break_end - self.break_start).total_seconds() / 3600.0, 2)
        return 0.0


class SubscriptionFeature(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    code = models.CharField(unique=True, max_length=255)
    description = models.TextField(blank=True, null=True)


class SubscriptionInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(unique=True, max_length=100)
    issue_date = models.DateField()
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    tax = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    total = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    status = models.CharField(max_length=50)
    payment_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    subscription = models.ForeignKey('Daycaresubscription', models.CASCADE, blank=True, null=True)


class SubscriptionPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    amount = models.DecimalField(max_digits=10, decimal_places=5)  # max_digits and decimal_places have been guessed, as this database handles decimal fields as float
    payment_date = models.DateField()
    currency = models.CharField(max_length=10)
    payment_method = models.CharField(max_length=100)
    payment_status = models.CharField(max_length=50)
    transaction_reference = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    daycare = models.ForeignKey('Daycare', models.CASCADE)
    invoice = models.ForeignKey('Subscriptioninvoice', models.CASCADE, blank=True, null=True)
    subscription = models.ForeignKey('Daycaresubscription', models.CASCADE, blank=True, null=True)


class SubscriptionPlanFeatures(models.Model):
    subscriptionplan = models.ForeignKey('Subscriptionplan', models.CASCADE)
    subscriptionfeature = models.ForeignKey('Subscriptionfeature', models.CASCADE)


class SupportTicket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(unique=True, max_length=50)
    subject = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=50)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('User', models.CASCADE)
    daycare = models.ForeignKey('Daycare', models.CASCADE)


class SupportTicketMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.TextField()
    created_at = models.DateTimeField()
    sender = models.ForeignKey('User', models.CASCADE)
    ticket = models.ForeignKey('Supportticket', models.CASCADE)


class SystemAnnouncement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    content = models.TextField()
    status = models.CharField(max_length=50)
    publish_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('User', models.CASCADE, blank=True, null=True)


class SystemAnnouncementTargetDaycares(models.Model):
    systemannouncement = models.ForeignKey('Systemannouncement', models.CASCADE)
    daycare = models.ForeignKey('Daycare', models.CASCADE)


class TimeOffRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    start_date = models.DateField()
    end_date = models.DateField()
    leave_type = models.CharField(max_length=50)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    approved_by = models.ForeignKey('User', models.CASCADE, blank=True, null=True)
    employee = models.ForeignKey('Employee', models.CASCADE)

class WaitlistEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    child_first_name = models.CharField(max_length=100)
    child_last_name = models.CharField(max_length=100)
    child_dob = models.DateField(blank=True, null=True)
    applicant_name = models.CharField(max_length=200)
    applicant_email = models.CharField(max_length=254)
    applicant_phone = models.CharField(max_length=20, blank=True, null=True)
    requested_start_date = models.DateField(blank=True, null=True)
    preferred_program = models.CharField(max_length=100, blank=True, null=True)
    preferred_branch = models.CharField(max_length=100, blank=True, null=True)
    priority = models.IntegerField()
    waitlist_date = models.DateTimeField()
    status = models.CharField(max_length=50)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    application = models.OneToOneField('RegistrationApplication', models.CASCADE, blank=True, null=True)
    daycare = models.ForeignKey('Daycare', models.CASCADE)

class EmploymentHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey('Employee', models.CASCADE, related_name='employment_history')
    employment_type = models.CharField(max_length=50) # Full-time, Part-time, Contract, Temporary
    job_title = models.CharField(max_length=100) # Teacher, ECE, Administrator, etc.
    department = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Active') # Active, Promoted, Transferred, Terminated, On Leave
    reason_for_change = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class EmployeeEmergencyContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class EmployeeAvailability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='availabilities')
    day_of_week = models.CharField(max_length=20) # Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    is_available = models.BooleanField(default=True)
    status = models.CharField(
        max_length=50, 
        default='Available', 
        choices=[
            ('Available', 'Available'),
            ('Unavailable', 'Unavailable'),
            ('Custom hours', 'Custom hours')
        ]
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def available_from(self):
        return self.start_time

    @property
    def available_to(self):
        return self.end_time


class StaffSchedule(models.Model):
    SHIFT_TYPES = [
        ('regular', 'Regular'),
        ('opening', 'Opening'),
        ('closing', 'Closing'),
        ('custom', 'Custom'),
    ]
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='staff_schedules')
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='schedules')
    date = models.DateField()
    shift_start = models.TimeField()
    shift_end = models.TimeField()
    shift_type = models.CharField(max_length=50, default='regular', choices=SHIFT_TYPES)
    classroom = models.ForeignKey('Classroom', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_schedules')
    branch = models.ForeignKey('Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_schedules')
    status = models.CharField(max_length=50, default='scheduled', choices=STATUS_CHOICES)
    duties = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_schedules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'shift_start']
        indexes = [
            models.Index(fields=['daycare', 'date']),
            models.Index(fields=['employee', 'date']),
        ]

    def __str__(self):
        return f"{self.employee.first_name} {self.employee.last_name} - {self.date} ({self.shift_start}-{self.shift_end})"

    @property
    def total_shift_hours(self):
        if self.shift_start and self.shift_end:
            from datetime import datetime
            start_dt = datetime.combine(self.date, self.shift_start)
            end_dt = datetime.combine(self.date, self.shift_end)
            diff = (end_dt - start_dt).total_seconds() / 3600.0
            return round(diff, 2)
        return 0.0

    @property
    def total_unpaid_break_hours(self):
        if not self.pk:
            return 0.0
        unpaid_breaks = self.breaks.filter(is_paid=False)
        total_seconds = 0.0
        from datetime import datetime
        for b in unpaid_breaks:
            if b.break_start and b.break_end:
                s_dt = datetime.combine(self.date, b.break_start)
                e_dt = datetime.combine(self.date, b.break_end)
                total_seconds += (e_dt - s_dt).total_seconds()
        return round(total_seconds / 3600.0, 2)

    @property
    def total_paid_break_hours(self):
        if not self.pk:
            return 0.0
        paid_breaks = self.breaks.filter(is_paid=True)
        total_seconds = 0.0
        from datetime import datetime
        for b in paid_breaks:
            if b.break_start and b.break_end:
                s_dt = datetime.combine(self.date, b.break_start)
                e_dt = datetime.combine(self.date, b.break_end)
                total_seconds += (e_dt - s_dt).total_seconds()
        return round(total_seconds / 3600.0, 2)

    @property
    def net_working_hours(self):
        net = self.total_shift_hours - self.total_unpaid_break_hours
        return max(0.0, round(net, 2))


class ShiftBreak(models.Model):
    BREAK_TYPES = [
        ('meal', 'Meal Break'),
        ('rest', 'Rest Break'),
        ('other', 'Other Break'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        StaffSchedule,
        on_delete=models.CASCADE,
        related_name='breaks'
    )
    break_start = models.TimeField()
    break_end = models.TimeField()
    break_type = models.CharField(max_length=50, default='meal', choices=BREAK_TYPES)
    is_paid = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['break_start']
        indexes = [
            models.Index(fields=['schedule', 'break_start']),
        ]

    def __str__(self):
        paid_str = "Paid" if self.is_paid else "Unpaid"
        return f"{self.get_break_type_display()} ({self.break_start}-{self.break_end}, {paid_str})"

    @property
    def duration_minutes(self):
        if self.break_start and self.break_end:
            from datetime import datetime, date
            dummy_date = date(2000, 1, 1)
            s_dt = datetime.combine(dummy_date, self.break_start)
            e_dt = datetime.combine(dummy_date, self.break_end)
            diff = (e_dt - s_dt).total_seconds() / 60.0
            return int(round(diff))
        return 0


class OvertimeRecord(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='overtime_records')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='overtime_records')
    attendance = models.ForeignKey(StaffAttendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='overtime_records')
    date = models.DateField()
    scheduled_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    actual_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    regular_hours = models.DecimalField(max_digits=5, decimal_places=2, default=8.0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    source = models.CharField(max_length=100, default='attendance')
    reason = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=50, default='pending', choices=STATUS_CHOICES)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_overtimes')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['daycare', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['status']),
        ]
        unique_together = [['employee', 'date']]

    def __str__(self):
        return f"Overtime: {self.employee.first_name} {self.employee.last_name} on {self.date} ({self.overtime_hours}h - {self.status})"


class TimeBankRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.OneToOneField(Daycare, on_delete=models.CASCADE, related_name='time_bank_rules')
    is_enabled = models.BooleanField(default=True)
    max_balance_hours = models.DecimalField(max_digits=6, decimal_places=2, default=40.0)
    require_approval = models.BooleanField(default=True)
    expiry_months = models.IntegerField(default=12, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Time Bank Rule for {self.daycare.name} (Enabled={self.is_enabled}, Max={self.max_balance_hours}h)"


class TimeBankTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('overtime_credit', 'Overtime Credit'),
        ('time_off_debit', 'Time-off Debit'),
        ('manual_adjustment', 'Manual Adjustment'),
        ('correction', 'Correction'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='time_bank_transactions')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='time_bank_transactions')
    transaction_type = models.CharField(max_length=50, choices=TRANSACTION_TYPES)
    hours = models.DecimalField(max_digits=5, decimal_places=2)  # positive number; debits subtract from balance
    date = models.DateField()
    reason = models.TextField()
    balance_after = models.DecimalField(max_digits=6, decimal_places=2)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_timebank_txns')
    overtime_record = models.ForeignKey(OvertimeRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name='time_bank_credits')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['daycare', 'employee']),
            models.Index(fields=['employee', 'date']),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()} ({self.hours}h) for {self.employee.first_name} on {self.date} -> Bal: {self.balance_after}h"


class ShiftSwapRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='shift_swap_requests')
    requesting_employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='swap_requests_sent'
    )
    target_employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='swap_requests_received'
    )
    requesting_shift = models.ForeignKey(
        StaffSchedule,
        on_delete=models.CASCADE,
        related_name='swap_requests_as_source'
    )
    target_shift = models.ForeignKey(
        StaffSchedule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='swap_requests_as_target'
    )
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=50, default='pending', choices=STATUS_CHOICES)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_shift_swaps'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['daycare', 'status']),
            models.Index(fields=['requesting_employee', 'status']),
            models.Index(fields=['target_employee', 'status']),
        ]

    def __str__(self):
        return f"Swap #{str(self.id)[:8]} ({self.requesting_employee.first_name} <-> {self.target_employee.first_name}) - {self.status}"


class LeaveType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='leave_types')
    name = models.CharField(max_length=100)  # e.g., "Sick Leave", "Vacation", "Holiday", "Other Leave"
    code = models.CharField(max_length=50)   # e.g., "sick", "vacation", "holiday", "other", "personal"
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    color_code = models.CharField(max_length=20, default='#4F46E5')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('daycare', 'code')
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.daycare.name})"


class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='leave_requests')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name='requests')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=50, default='pending', choices=STATUS_CHOICES)
    requested_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leaves'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    affected_shifts_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['daycare', 'status']),
            models.Index(fields=['employee', 'start_date']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f"Leave #{str(self.id)[:8]} - {self.employee.first_name} ({self.leave_type.name}: {self.start_date} to {self.end_date}) [{self.status}]"


class StaffShortageAlert(models.Model):
    LEVEL_CHOICES = [
        ('warning', 'Warning'),
        ('critical', 'Critical')
    ]
    STATUS_CHOICES = [
        ('active', 'Active Shortage'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='shortage_alerts')
    date = models.DateField()
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='shortage_alerts', null=True, blank=True)
    alert_level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='critical')
    required_staff = models.IntegerField(default=1)
    scheduled_staff = models.IntegerField(default=0)
    shortage_count = models.IntegerField(default=0)
    reason = models.TextField()
    status = models.CharField(max_length=50, default='active', choices=STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['daycare', 'date']),
            models.Index(fields=['status']),
            models.Index(fields=['alert_level']),
        ]

    def __str__(self):
        return f"Shortage on {self.date} ({self.classroom.room_name if self.classroom else 'General'}): Short by {self.shortage_count} staff [{self.alert_level}]"


class StaffNotification(models.Model):
    NOTIFICATION_TYPES = [
        ('leave_requested', 'Leave Requested'),
        ('leave_approved', 'Leave Approved'),
        ('leave_rejected', 'Leave Rejected'),
        ('shift_affected', 'Shift Coverage Affected'),
        ('staff_shortage', 'Staff Shortage Alert'),
        ('child_not_arrived', 'Child Not Checked In'),
        ('child_missing_checkout', 'Missing Child Checkout'),
        ('attendance_correction', 'Attendance Correction'),
        ('timesheet_submitted', 'Timesheet Submitted'),
        ('timesheet_approved', 'Timesheet Approved'),
        ('timesheet_rejected', 'Timesheet Rejected'),
        ('missing_staff_clockout', 'Missing Staff Clock-Out'),
        ('overtime_approval_required', 'Overtime Approval Required'),
        ('unauthorized_pickup_attempt', 'Unauthorized Pickup Attempt'),
        ('late_pickup_recorded', 'Late Pickup Recorded'),
        ('daily_report_published', 'Daily Report Published'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='staff_notifications')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='staff_notifications', null=True, blank=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['daycare', 'user', 'is_read']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title}"


class RatioRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='ratio_rules', null=True, blank=True)
    province = models.ForeignKey('Province', on_delete=models.SET_NULL, null=True, blank=True, related_name='ratio_rules')
    program = models.ForeignKey('Program', on_delete=models.SET_NULL, null=True, blank=True, related_name='ratio_rules')
    program_type = models.CharField(max_length=100, null=True, blank=True)
    age_group = models.ForeignKey('AgeGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='ratio_rules')
    name = models.CharField(max_length=255)
    min_age_months = models.IntegerField(default=0)
    max_age_months = models.IntegerField(default=72)
    minimum_children = models.IntegerField(default=0)
    maximum_children = models.IntegerField(null=True, blank=True)
    required_staff = models.IntegerField(default=1)
    qualified_staff_required = models.IntegerField(default=1)
    max_children_per_staff = models.IntegerField(default=5)  # e.g., 3 for Infant, 5 for Toddler, 8 for Preschool, 10 for Kindergarten
    warning_threshold_buffer = models.IntegerField(default=1)  # Buffer from capacity to trigger WARNING status
    requires_qualified_ece = models.BooleanField(default=True)
    qualification_requirement = models.CharField(max_length=255, default='Certified ECE')
    effective_from = models.DateField(default=datetime.date.today)
    effective_to = models.DateField(null=True, blank=True)
    is_system_rule = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_ratio_rules')
    updated_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_ratio_rules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['min_age_months', 'name']

    @property
    def effective_until(self):
        return self.effective_to

    @effective_until.setter
    def effective_until(self, value):
        self.effective_to = value

    @property
    def active(self):
        return self.is_active

    @active.setter
    def active(self, value):
        self.is_active = value

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.effective_to and self.effective_from and self.effective_to < self.effective_from:
            raise ValidationError({'effective_to': "effective_to cannot be earlier than effective_from."})
        if self.min_age_months is not None and self.min_age_months < 0:
            raise ValidationError({'min_age_months': "min_age_months cannot be negative."})
        if self.max_age_months is not None and self.min_age_months is not None and self.max_age_months < self.min_age_months:
            raise ValidationError({'max_age_months': "max_age_months cannot be less than min_age_months."})
        if self.minimum_children is not None and self.minimum_children < 0:
            raise ValidationError({'minimum_children': "minimum_children cannot be negative."})
        if self.maximum_children is not None and self.minimum_children is not None and self.maximum_children < self.minimum_children:
            raise ValidationError({'maximum_children': "maximum_children cannot be less than minimum_children."})
        if self.max_children_per_staff is not None and self.max_children_per_staff < 1:
            raise ValidationError({'max_children_per_staff': "max_children_per_staff must be at least 1."})
        if self.required_staff is not None and self.required_staff < 1:
            raise ValidationError({'required_staff': "required_staff must be at least 1."})
        if self.qualified_staff_required is not None and self.qualified_staff_required < 0:
            raise ValidationError({'qualified_staff_required': "qualified_staff_required cannot be negative."})
        if self.qualified_staff_required is not None and self.required_staff is not None and self.qualified_staff_required > self.required_staff:
            raise ValidationError({'qualified_staff_required': "qualified_staff_required cannot exceed required_staff."})
        if self.warning_threshold_buffer is not None and self.warning_threshold_buffer < 0:
            raise ValidationError({'warning_threshold_buffer': "warning_threshold_buffer cannot be negative."})

    def __str__(self):
        prov = f" [{self.province.code}]" if self.province else ""
        return f"{self.name}{prov} (1:{self.max_children_per_staff})"


class RatioManualOverride(models.Model):
    OVERRIDE_STATUS_CHOICES = [
        ('COMPLIANT', 'Compliant'),
        ('WARNING', 'Warning'),
        ('NON_COMPLIANT', 'Non-Compliant'),
        ('EXEMPT', 'Exempt'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='ratio_overrides')
    classroom = models.ForeignKey('Classroom', on_delete=models.CASCADE, related_name='ratio_overrides')
    override_status = models.CharField(max_length=50, choices=OVERRIDE_STATUS_CHOICES)
    reason = models.TextField()
    created_by = models.ForeignKey('User', on_delete=models.CASCADE, related_name='created_ratio_overrides')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Override {self.classroom.room_name}: {self.override_status} (by {self.created_by})"


class RatioComplianceHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey('Daycare', on_delete=models.CASCADE, related_name='ratio_compliance_history')
    classroom = models.ForeignKey('Classroom', on_delete=models.CASCADE, related_name='ratio_compliance_history')
    evaluated_at = models.DateTimeField(default=timezone.now)
    children_present = models.IntegerField(default=0)
    qualified_staff_present = models.IntegerField(default=0)
    total_staff_present = models.IntegerField(default=0)
    required_staff = models.IntegerField(default=0)
    calculated_ratio = models.CharField(max_length=50, default='0:0')
    calculated_status = models.CharField(max_length=50, default='COMPLIANT')
    rule_used = models.ForeignKey('RatioRule', on_delete=models.SET_NULL, null=True, blank=True, related_name='compliance_logs')
    rule_snapshot = models.JSONField(default=dict, blank=True)
    override_applied = models.BooleanField(default=False)
    override_status = models.CharField(max_length=50, null=True, blank=True)
    override_reason = models.TextField(null=True, blank=True)
    override_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='applied_ratio_overrides')
    final_status = models.CharField(max_length=50, default='COMPLIANT')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-evaluated_at', '-created_at']
        indexes = [
            models.Index(fields=['daycare', 'classroom', 'evaluated_at']),
            models.Index(fields=['daycare', 'final_status']),
            models.Index(fields=['evaluated_at']),
        ]

    def __str__(self):
        return f"{self.classroom.room_name} ({self.evaluated_at.strftime('%Y-%m-%d %H:%M')}) - {self.final_status}"


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 1 - FEE STRUCTURE & CONFIGURATION)
# ==============================================================================

class FeeStructure(models.Model):
    FEE_TYPE_CHOICES = [
        ('REGISTRATION', 'Registration Fee'),
        ('MONTHLY', 'Monthly Childcare Fee'),
        ('WEEKLY', 'Weekly Childcare Fee'),
        ('DAILY', 'Daily Childcare Fee'),
        ('HOURLY', 'Hourly Childcare Fee'),
        ('DEPOSIT', 'Security / Enrollment Deposit'),
        ('OTHER', 'Other Activity or Supply Fee'),
    ]

    FREQUENCY_CHOICES = [
        ('ONE_TIME', 'One-Time'),
        ('MONTHLY', 'Monthly'),
        ('WEEKLY', 'Weekly'),
        ('DAILY', 'Daily'),
        ('HOURLY', 'Hourly'),
    ]

    APPLIES_TO_CHOICES = [
        ('ALL', 'All Children'),
        ('PROGRAM', 'Specific Program'),
        ('BRANCH', 'Specific Branch'),
        ('CLASSROOM', 'Specific Classroom'),
        ('INDIVIDUAL', 'Individual / Custom Assignment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='fee_structures')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_structures')
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    fee_type = models.CharField(max_length=50, choices=FEE_TYPE_CHOICES)
    frequency = models.CharField(max_length=50, choices=FREQUENCY_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')
    
    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    applies_to = models.CharField(max_length=50, default='ALL', choices=APPLIES_TO_CHOICES)
    
    version = models.IntegerField(default=1)
    parent_fee = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='historical_versions')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_fee_structures')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_fee_structures')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'name', '-effective_from']
        indexes = [
            models.Index(fields=['daycare', 'is_active']),
            models.Index(fields=['daycare', 'fee_type']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        return f"{self.name} - {self.amount} {self.currency} ({self.get_fee_type_display()}) [v{self.version}]"

    def is_effective_on(self, target_date):
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return True


class ChildFeeAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='child_fee_assignments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fee_assignments')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_assignments')
    family = models.ForeignKey(Family, on_delete=models.SET_NULL, null=True, blank=True, related_name='fee_assignments')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.PROTECT, related_name='assignments')
    
    # Custom rate override if negotiated specifically for this student / family
    custom_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_reason = models.CharField(max_length=255, null=True, blank=True)
    currency = models.CharField(max_length=10, default='CAD')
    
    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_fee_assignments')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_fee_assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', '-effective_from', 'student__first_name']
        indexes = [
            models.Index(fields=['daycare', 'student', 'is_active']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        amt = self.custom_amount if self.custom_amount is not None else self.fee_structure.amount
        return f"Assignment: {self.student.first_name} {self.student.last_name} -> {self.fee_structure.name} ({amt} {self.currency})"

    @property
    def effective_rate(self):
        base = self.custom_amount if self.custom_amount is not None else self.fee_structure.amount
        if self.discount_percentage > 0:
            from decimal import Decimal, ROUND_HALF_UP
            discount_mult = Decimal('1.00') - (Decimal(str(self.discount_percentage)) / Decimal('100.00'))
            return (base * discount_mult).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return base

    def is_effective_on(self, target_date):
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return self.is_active


class RegistrationFeeRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Invoicing'),
        ('INVOICED', 'Invoiced'),
        ('PAID', 'Paid'),
        ('WAIVED', 'Waived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='registration_fee_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='registration_fee_records')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='registration_fee_records')
    family = models.ForeignKey(Family, on_delete=models.SET_NULL, null=True, blank=True, related_name='registration_fee_records')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.PROTECT, related_name='registration_records')
    
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')
    status = models.CharField(max_length=50, default='PENDING', choices=STATUS_CHOICES)
    
    waived_reason = models.TextField(blank=True, null=True)
    waived_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='waived_registration_fees')
    waived_at = models.DateTimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_registration_fees')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('daycare', 'student', 'fee_structure')
        indexes = [
            models.Index(fields=['daycare', 'student', 'status']),
        ]

    def __str__(self):
        return f"Registration Fee: {self.student.first_name} {self.student.last_name} - {self.amount} {self.currency} ({self.status})"


class DepositRecord(models.Model):
    STATUS_CHOICES = [
        ('CHARGED', 'Deposit Charged'),
        ('HELD', 'Deposit Held in Trust'),
        ('PARTIALLY_APPLIED', 'Partially Applied'),
        ('FULLY_APPLIED', 'Fully Applied to Childcare'),
        ('PARTIALLY_REFUNDED', 'Partially Refunded'),
        ('REFUNDED', 'Fully Refunded'),
        ('FORFEITED', 'Forfeited'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='deposit_records')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='deposit_records')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='deposit_records')
    family = models.ForeignKey(Family, on_delete=models.SET_NULL, null=True, blank=True, related_name='deposit_records')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.PROTECT, null=True, blank=True, related_name='deposit_records')
    
    amount_charged = models.DecimalField(max_digits=12, decimal_places=2)
    amount_held = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_applied = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_refunded = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_forfeited = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='CAD')
    
    status = models.CharField(max_length=50, default='CHARGED', choices=STATUS_CHOICES)
    received_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_deposits')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_deposits')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['daycare', 'student', 'status']),
        ]

    def __str__(self):
        return f"Deposit: {self.student.first_name} {self.student.last_name} - Held: {self.amount_held} {self.currency} ({self.status})"

    @property
    def remaining_held(self):
        from decimal import Decimal
        return max(Decimal('0.00'), Decimal(str(self.amount_held)) - Decimal(str(self.amount_applied)) - Decimal(str(self.amount_refunded)) - Decimal(str(self.amount_forfeited)))


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 2 - DISCOUNTS, CREDITS & LATE FEES)
# ==============================================================================

class DiscountRule(models.Model):
    DISCOUNT_TYPE_CHOICES = [
        ('PERCENTAGE', 'Percentage Discount'),
        ('FIXED', 'Fixed Amount Discount'),
    ]

    APPLIES_TO_CHOICES = [
        ('ALL', 'Daycare Wide / All Children'),
        ('STUDENT', 'Specific Child / Student'),
        ('FAMILY', 'Specific Family'),
        ('ENROLLMENT', 'Specific Classroom Enrollment'),
        ('PROGRAM', 'Specific Program'),
        ('CLASSROOM', 'Specific Classroom'),
        ('BRANCH', 'Specific Branch'),
        ('FEE_TYPE', 'Specific Fee Type'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='discount_rules')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')
    family = models.ForeignKey('Family', on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_rules')

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    discount_type = models.CharField(max_length=50, choices=DISCOUNT_TYPE_CHOICES, default='PERCENTAGE')
    value = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')

    applies_to = models.CharField(max_length=50, choices=APPLIES_TO_CHOICES, default='ALL')
    target_fee_type = models.CharField(max_length=50, choices=FeeStructure.FEE_TYPE_CHOICES, null=True, blank=True)
    eligibility_criteria = models.JSONField(default=dict, blank=True)
    priority = models.IntegerField(default=10)

    effective_from = models.DateField(default=datetime.date.today, blank=True, null=True)
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    version = models.IntegerField(default=1)
    parent_rule = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='historical_versions')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_discount_rules')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_discount_rules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'priority', 'name', '-effective_from']
        indexes = [
            models.Index(fields=['daycare', 'is_active']),
            models.Index(fields=['applies_to', 'is_active']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        val_str = f"{self.value}%" if self.discount_type == 'PERCENTAGE' else f"{self.value} {self.currency}"
        return f"Discount: {self.name} ({val_str}) [v{self.version}]"

    def is_effective_on(self, target_date):
        if not self.is_active:
            return False
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return True


class SiblingDiscountRule(models.Model):
    DISCOUNT_TYPE_CHOICES = [
        ('PERCENTAGE', 'Percentage Discount'),
        ('FIXED', 'Fixed Amount Discount'),
    ]

    APPLIES_TO_CHOICES = [
        ('SECOND_CHILD', 'Second Child Only'),
        ('SUBSEQUENT_CHILDREN', 'Second and Subsequent Children (2nd, 3rd, 4th, etc.)'),
        ('ALL_SIBLINGS', 'All Enrolled Siblings in Family'),
    ]

    TARGET_FEE_CHOICES = [
        ('LOWEST_FEE', 'Lowest Fee Child'),
        ('HIGHEST_FEE', 'Highest Fee Child'),
        ('EQUAL_APPLY', 'Apply Configured Discount to Eligible Siblings'),
    ]

    ORDERING_CHOICES = [
        ('AGE_DESCENDING', 'Birth Date (Eldest is 1st child, Younger is 2nd+ child)'),
        ('FEE_DESCENDING', 'Fee Amount (Highest fee is 1st child, Lower is 2nd+ child)'),
        ('ENROLLMENT_DATE', 'Enrollment Date (First enrolled is 1st child)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='sibling_discount_rules')
    name = models.CharField(max_length=255, default='Sibling Discount Policy')
    description = models.TextField(blank=True, null=True)

    discount_type = models.CharField(max_length=50, choices=DISCOUNT_TYPE_CHOICES, default='PERCENTAGE')
    value = models.DecimalField(max_digits=10, decimal_places=2, default=10.00)
    currency = models.CharField(max_length=10, default='CAD')

    applies_to_target = models.CharField(max_length=50, choices=APPLIES_TO_CHOICES, default='SUBSEQUENT_CHILDREN')
    target_fee_selection = models.CharField(max_length=50, choices=TARGET_FEE_CHOICES, default='LOWEST_FEE')
    ordering_criteria = models.CharField(max_length=50, choices=ORDERING_CHOICES, default='AGE_DESCENDING')
    min_enrolled_siblings = models.IntegerField(default=2)

    effective_from = models.DateField(default=datetime.date.today, blank=True, null=True)
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    version = models.IntegerField(default=1)
    parent_rule = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='historical_versions')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_sibling_discount_rules')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_sibling_discount_rules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', '-effective_from']
        indexes = [
            models.Index(fields=['daycare', 'is_active']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        val_str = f"{self.value}%" if self.discount_type == 'PERCENTAGE' else f"{self.value} {self.currency}"
        return f"Sibling Discount: {self.name} ({val_str} on {self.get_applies_to_target_display()}) [v{self.version}]"

    def is_effective_on(self, target_date):
        if not self.is_active:
            return False
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return True


class CreditTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ('CREDIT', 'Credit Grant / Deposit / Overpayment'),
        ('CREDIT_APPLIED', 'Credit Applied to Invoicing'),
        ('CREDIT_ADJUSTMENT', 'Administrative Balance Adjustment'),
        ('CREDIT_REVERSAL', 'Credit Reversal'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('REVERSED', 'Reversed'),
        ('VOID', 'Voided'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='credit_transactions')
    family = models.ForeignKey('Family', on_delete=models.CASCADE, related_name='credit_transactions')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_transactions')
    enrollment = models.ForeignKey(ClassroomStudent, on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_transactions')

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')
    transaction_type = models.CharField(max_length=50, choices=TRANSACTION_TYPE_CHOICES)
    reason = models.CharField(max_length=255)
    reference = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='ACTIVE', choices=STATUS_CHOICES)

    reversed_transaction = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversals')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_credit_transactions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['daycare', 'family', 'status']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.transaction_type}: {self.amount} {self.currency} for {self.family.family_name} ({self.reason})"


class LateFeeRule(models.Model):
    FEE_TYPE_CHOICES = [
        ('FIXED', 'Fixed Amount Fee'),
        ('PERCENTAGE', 'Percentage of Overdue Balance'),
    ]

    FREQUENCY_CHOICES = [
        ('ONE_TIME', 'One-Time Late Fee'),
        ('DAILY', 'Daily Recurring Late Fee'),
        ('WEEKLY', 'Weekly Recurring Late Fee'),
        ('MONTHLY', 'Monthly Recurring Late Fee'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='late_fee_rules')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    fee_type = models.CharField(max_length=50, choices=FEE_TYPE_CHOICES, default='FIXED')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')

    grace_period_days = models.IntegerField(default=5)
    frequency = models.CharField(max_length=50, choices=FREQUENCY_CHOICES, default='ONE_TIME')
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    effective_from = models.DateField(default=datetime.date.today, blank=True, null=True)
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    version = models.IntegerField(default=1)
    parent_rule = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='historical_versions')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_late_fee_rules')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_late_fee_rules')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'name', '-effective_from']
        indexes = [
            models.Index(fields=['daycare', 'is_active']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        val_str = f"{self.amount}%" if self.fee_type == 'PERCENTAGE' else f"{self.amount} {self.currency}"
        return f"Late Fee Rule: {self.name} ({val_str}, Grace: {self.grace_period_days}d) [v{self.version}]"

    def is_effective_on(self, target_date):
        if not self.is_active:
            return False
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return True


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 3 - RECURRING BILLING PROFILES)
# ==============================================================================

class RecurringBillingProfile(models.Model):
    FREQUENCY_CHOICES = [
        ('MONTHLY', 'Monthly Recurring'),
        ('WEEKLY', 'Weekly Recurring'),
        ('BI_WEEKLY', 'Bi-Weekly Recurring'),
        ('DAILY', 'Daily Recurring'),
    ]

    BILLING_BASIS_CHOICES = [
        ('CALENDAR_ADVANCE', 'Fixed Advance Cycle (Standard Plan Fee)'),
        ('ATTENDANCE_ACTUAL', 'Attendance-Based Actual Days (Daily Rate)'),
        ('TIMESHEET_HOURLY', 'Attendance-Based Billable Hours (Hourly Rate)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='recurring_billing_profiles')
    branch = models.ForeignKey('Branch', on_delete=models.SET_NULL, null=True, blank=True, related_name='recurring_billing_profiles')
    family = models.ForeignKey('Family', on_delete=models.CASCADE, related_name='recurring_billing_profiles')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='recurring_billing_profiles')
    enrollment = models.ForeignKey('ClassroomStudent', on_delete=models.SET_NULL, null=True, blank=True, related_name='recurring_billing_profiles')
    fee_structure = models.ForeignKey(FeeStructure, on_delete=models.PROTECT, related_name='recurring_profiles')

    profile_name = models.CharField(max_length=255, null=True, blank=True)
    frequency = models.CharField(max_length=50, choices=FREQUENCY_CHOICES, default='MONTHLY')
    billing_day = models.IntegerField(default=1) # 1-31 for monthly (or 0-6 day of week)
    billing_basis = models.CharField(max_length=50, choices=BILLING_BASIS_CHOICES, default='CALENDAR_ADVANCE')
    
    auto_apply_credits = models.BooleanField(default=True)
    auto_apply_deposits = models.BooleanField(default=False)

    start_date = models.DateField(default=datetime.date.today, null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    next_billing_date = models.DateField()
    last_billed_date = models.DateField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_recurring_profiles')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_recurring_profiles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', 'next_billing_date', 'family__family_name']
        indexes = [
            models.Index(fields=['daycare', 'is_active']),
            models.Index(fields=['next_billing_date', 'is_active']),
        ]

    def __str__(self):
        target = f"{self.student.first_name} {self.student.last_name}" if self.student else self.family.family_name
        return f"Recurring Profile: {target} -> {self.fee_structure.name} ({self.frequency}, Next: {self.next_billing_date})"


# ==============================================================================
# MODULE 16: BILLING & INVOICING (PHASE 4 - SUBSIDIES & ANNUAL TAX RECEIPTS)
# ==============================================================================

class ChildSubsidyProfile(models.Model):
    SUBSIDY_TYPE_CHOICES = [
        ('PERCENTAGE', 'Percentage Fee Reduction (e.g. CWELCC 52.75%)'),
        ('FIXED_MONTHLY', 'Fixed Monthly Subsidy Amount'),
        ('FIXED_DAILY', 'Fixed Daily Subsidy Amount'),
        ('CUSTOM_RATE', 'Custom / Flat Parent Portion Co-Pay'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='subsidy_profiles')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='subsidy_profiles')
    family = models.ForeignKey('Family', on_delete=models.SET_NULL, null=True, blank=True, related_name='subsidy_profiles')

    program_name = models.CharField(max_length=255, default='CWELCC Fee Reduction')
    subsidy_type = models.CharField(max_length=50, choices=SUBSIDY_TYPE_CHOICES, default='PERCENTAGE')
    subsidy_rate = models.DecimalField(max_digits=10, decimal_places=2, default=52.75) # Percentage or fixed money amount
    currency = models.CharField(max_length=10, default='CAD')

    government_case_number = models.CharField(max_length=100, blank=True, null=True)
    parent_co_pay_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approved_days_per_week = models.IntegerField(default=5)

    effective_from = models.DateField(default=datetime.date.today, blank=True, null=True)
    effective_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_subsidy_profiles')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_subsidy_profiles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_active', '-effective_from', 'student__first_name']
        indexes = [
            models.Index(fields=['daycare', 'student', 'is_active']),
            models.Index(fields=['effective_from', 'effective_until']),
        ]

    def __str__(self):
        val = f"{self.subsidy_rate}%" if self.subsidy_type == 'PERCENTAGE' else f"{self.subsidy_rate} {self.currency}"
        return f"Subsidy: {self.student.first_name} {self.student.last_name} -> {self.program_name} ({val})"

    def is_effective_on(self, target_date):
        if not self.is_active:
            return False
        if self.effective_from and target_date < self.effective_from:
            return False
        if self.effective_until and target_date > self.effective_until:
            return False
        return True


class TaxReceipt(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ISSUED', 'Issued / Official'),
        ('VOID', 'Voided'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='tax_receipts')
    family = models.ForeignKey('Family', on_delete=models.CASCADE, related_name='tax_receipts')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='tax_receipts')

    tax_year = models.IntegerField(default=2025)
    receipt_number = models.CharField(max_length=100, unique=True) # e.g. TAX-SUN-2025-0001

    # Recipient details (Parent / Guardian)
    recipient_name = models.CharField(max_length=255)
    recipient_address = models.TextField(blank=True, null=True)

    # Daycare Legal & Tax Identifiers
    daycare_legal_name = models.CharField(max_length=255)
    daycare_business_number = models.CharField(max_length=100, blank=True, null=True) # CRA BN / SIN / Charity #
    daycare_address = models.TextField(blank=True, null=True)

    # Financial breakdown
    total_eligible_fees_paid = models.DecimalField(max_digits=12, decimal_places=2)
    total_subsidies_deducted = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    net_claimable_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='CAD')

    service_period_start = models.DateField()
    service_period_end = models.DateField()
    issued_date = models.DateField(default=datetime.date.today)

    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='ISSUED')
    void_reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tax_receipts')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_tax_receipts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-tax_year', '-issued_date', 'receipt_number']
        unique_together = ('daycare', 'family', 'tax_year', 'receipt_number')
        indexes = [
            models.Index(fields=['daycare', 'tax_year', 'status']),
            models.Index(fields=['family', 'tax_year']),
            models.Index(fields=['receipt_number']),
        ]

    def __str__(self):
        return f"Tax Receipt: {self.receipt_number} ({self.tax_year}) - {self.recipient_name} -> {self.net_claimable_amount} {self.currency}"











