from django.contrib import admin
from .models import Entry
@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display=['title','kind','owner','created_at']
    search_fields=['title','summary']
    list_filter=['kind']
    def has_module_permission(self,request): return request.user.is_superuser
    def has_view_permission(self,request,obj=None): return request.user.is_superuser
    def has_change_permission(self,request,obj=None): return False
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return request.user.is_superuser
