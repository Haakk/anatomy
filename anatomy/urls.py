from django.conf.urls import patterns, include, url
from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.generic import RedirectView
from django.http import HttpResponse
from filebrowser.sites import site

admin.autodiscover()

js_info_dict = {
    'domain': 'djangojs',
    'packages': ('anatomy',),
}


urlpatterns = patterns(
    '',
    url(
        r'^media/(?P<path>.*)', 'django.views.static.serve',
        {
            'document_root': settings.MEDIA_ROOT
        }
    ),
    url(r'^$', 'anatomy.views.home', name='home'),
    url(r'^invoice/(?P<subscription_id>\d+)$', 'anatomy.views.invoice', name='invoice'),
    url(r'^(about|home|offer|premium|overview|unauthorized|settings|relationsoverview|terms-of-use-|privacy-policy-)',
        'anatomy.views.home', name='home'),
    url(r'^(view/\w*|u/\w*|relations/\w*|u/\w*|image/\w*|u/\w*|practice/\w*/?\w*|refreshpractice/\w*/?\w*)',
        'anatomy.views.home', name='home'),
    url(r'^favicon\.ico$', RedirectView.as_view(url='static/img/favicon.png')),
    url(r'^robots.txt$', lambda r: HttpResponse(
        "User-agent: *\nDisallow: /terms-of-use-*", content_type="text/plain")),
    url(r'^load_flashcards/', 'anatomy.views.load_flashcards', name='load_flashcards'),
    url(r'^savescreenshot/', 'anatomy.views.save_screenshot', name='save_screenshot'),
    url(r'^all_flashcards/', 'anatomy.views.all_flashcards', name='all_flashcards'),

    url(r'^user/', include('proso_user.urls')),
    url(r'^models/', include('proso_models.urls')),
    url(r'^configab/', include('proso_configab.urls')),
    url(r'^common/', include('proso_common.urls')),
    url(r'^admin/filebrowser/', include(site.urls)),
    url(r'^grappelli/', include('grappelli.urls')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^convert/', include('lazysignup.urls')),
    url(r'^feedback/', include('proso_feedback.urls')),
    url(r'^flashcards/', include('proso_flashcards.urls')),
    url(r'^subscription/', include('proso_subscription.urls')),
    url(r'^gopay/', include('gopay_django_api.urls')),
    url('', include('social.apps.django_app.urls', namespace='social')),
)
urlpatterns += staticfiles_urlpatterns()
