from django.urls import path
from .views import EntryList, EntryDetail, EntryManage, UploadStart, UploadStatus, UploadChunk
urlpatterns=[path('learning/uploads/',UploadStart.as_view()),path('learning/uploads/<uuid:id>/',UploadStatus.as_view()),path('learning/uploads/<uuid:id>/chunks/',UploadChunk.as_view())]
for kind in ['lessons','facts']:
    urlpatterns += [path(kind+'/',EntryList.as_view(),{'kind':kind}),path(kind+'/publish/',EntryManage.as_view(),{'kind':kind}),path(kind+'/<uuid:id>/',EntryDetail.as_view(),{'kind':kind}),path(kind+'/<uuid:id>/manage/',EntryManage.as_view(),{'kind':kind})]
