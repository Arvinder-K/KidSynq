from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

UserModel = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if not username or password is None:
            return None
        
        users = UserModel.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=username)
        )
        
        if not users.exists():
            # Run default password hasher once to reduce timing difference
            UserModel().set_password(password)
            return None
            
        for user in users:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
                
        return None
