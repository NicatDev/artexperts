from django.core.management.base import BaseCommand
from learning.views import cleanup
class Command(BaseCommand):
    help='Remove unattached teaching media older than 48 hours (also runs when uploads start).'
    def handle(self,*args,**kwargs):
        cleanup()
        self.stdout.write('Expired teaching uploads cleaned.')
