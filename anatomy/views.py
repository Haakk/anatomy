# -*- coding: utf-8 -*-
from django.conf import settings
from django.shortcuts import render_to_response, redirect
import json
from django.utils.translation import ugettext as _
from django.utils.translation import get_language
from proso_common.models import get_global_config
from proso_flashcards.models import Category
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core import management
from django.http import HttpResponse, HttpResponseBadRequest
from django.core.cache import cache
import os
from proso_models.models import get_environment
from proso_flashcards.models import FlashcardAnswer, Flashcard
from datetime import datetime, timedelta
import random
import base64
from proso_subscription.models import Subscription
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from gopay.enums import PaymentStatus


@login_required
def invoice(request, subscription_id):
    subscription = get_object_or_404(Subscription, pk=subscription_id)
    if not request.user.is_staff and subscription.user_id != request.user.id:
        return HttpResponse('Unauthorized', status=401)
    if subscription.payment is None or subscription.payment.state != PaymentStatus.PAID:
        return HttpResponse('There is no invoice for the given subscription.', 400)
    return render_to_response('invoice.html', {
        'subscription': subscription,
        'user': request.user,
    })


@ensure_csrf_cookie
def home(request, hack=None):
    min_hack = '.min' if 'unmin' not in request.GET else ''
    print(min_hack, request.GET.get('unmin', 'HHH'))

    JS_FILES = (
        "dist/js/bower-libs" + min_hack + ".js",
        "dist/js/unminifiable-libs.js",
        "dist/js/anatomy" + min_hack + ".js",
    )
    CSS_FILES = (
        "dist/css/bower-libs.css",
        "dist/css/app.css",
    )

    if not hasattr(request.user, "userprofile") or request.user.userprofile is None:
        environment = get_environment()
        user = json.dumps({
            'user': {},
            'number_of_answers': environment.number_of_answers(user=request.user.id) if request.user.id is not None else 0,
            'number_of_correct_answers': environment.number_of_correct_answers(user=request.user.id) if request.user.id is not None else 0,
        })
        email = ''
    else:
        if hack is None:
            return redirect('/overview/')
        user = request.user.userprofile.to_json(stats=True)
        # TODO remove settings.ON_PRODUCTION hack when launching subscriptions
        user['subscribed'] = settings.ON_PRODUCTION or has_active_subscription(request)
        user = json.dumps(user)
        email = request.user.email
        if not request.user.userprofile.public:
            request.user.userprofile.public = True
            request.user.userprofile.save()
    hour_ago = datetime.now() - timedelta(hours=1)
    stats = {
        'number_of_answers': FlashcardAnswer.objects.count(),
        'answers_per_second': FlashcardAnswer.objects.filter(
            time__gt=hour_ago).count() / 3600.0,
        'number_of_flashcards': Flashcard.objects.filter(
            active=True, lang=get_language()).count(),
    }
    if hack == 'home':
        hack = None
    c = {
        'title': _('Anatom.cz') + ' - ' + _('procvičování anatomie člověka v obrázcích'),
        'headline': get_headline_from_url(hack),
        'is_production': settings.ON_PRODUCTION,
        'css_files': CSS_FILES,
        'js_files': JS_FILES,
        'screenshot_files': get_screenshot_files(request, hack),
        'user_json': user,
        'email': email,
        'LANGUAGE_CODE': get_language(),
        'LANGUAGES': settings.LANGUAGES,
        'LANGUAGE_DOMAINS': settings.LANGUAGE_DOMAINS,
        'is_homepage': hack is None,
        'hack': hack or '',
        'config_json': json.dumps(get_global_config()),
        'DOMAIN': request.build_absolute_uri('/')[:-1],
        'stats_json': json.dumps(stats),
        'canonical_url': 'https://' + request.META['HTTP_HOST'] + request.get_full_path().split('?')[0].replace('//', '/'),
        'base': '//' + request.META['HTTP_HOST'],
        'canonical_path':  request.get_full_path().split('?')[0][1:].replace('//', '/'),
    }
    return render_to_response('home.html', c)


def get_screenshot_files(request, hack):
    screenshot_files = [
        "/static/img/screenshot-" + get_language() + ".png",
        "/static/img/practice-" + get_language() + ".png",
        "/static/img/select-" + get_language() + ".png",
        "/static/img/view-image-" + get_language() + ".png",
    ]

    path = os.path.join(settings.STATICFILES_DIRS[0], 'img', 'thumb')
    dirs = os.listdir(path)

    for file in dirs:
        if get_language() + '.png' in file:
            screenshot_files.append('/static/img/thumb/' + file)
    random.shuffle(screenshot_files)
    screenshot_files[0] = "/static/img/thumb/practice-heart-" + get_language() + ".png"
    if request.GET.get('thumb', None) is not None:
        screenshot_files[0] = "/static/img/thumb/" + request.GET['thumb'] + "-" + get_language() + ".png"
    return screenshot_files[:5]


def get_headline_from_url(hack):
    headline = ""
    if hack:
        url = hack.split('/')
        if url[0] == 'view' or url[0] == 'practice':
            try:
                category = Category.objects.get(
                    lang=get_language(), identifier=url[1])
                headline = category.name
            except Category.DoesNotExist:
                pass
            try:
                if len(url) > 2:
                    category = Category.objects.get(
                        lang=get_language(), identifier=url[2])
                    headline += ' - ' + category.name
            except Category.DoesNotExist:
                pass
        elif url[0] == 'overview':
            headline = _('Přehled znalostí')
    return headline


def load_flashcards(request):
    context = request.GET.get('context', '')
    filepath = os.path.join(os.environ.get('EXPORT_PATH', '.'), 'image-' + context + '.json')
    if os.path.isfile(filepath):
        management.call_command(
            'load_flashcards',
            filepath,
            ignored_flashcards='disable',
            skip_language_check=True,
            verbosity=0,
            interactive=False)
        cache.clear()
        response = """{
            "type": "success",
            "msg" : "Obrázek byl úspěšně nahrán na %s"
        }""" % request.build_absolute_uri('/')[:-1]
        if request.GET['callback'] is not None:
                response = request.GET['callback'] + '(' + response + ')'
        return HttpResponse(response, content_type='application/javascript')
    else:
        return HttpResponseBadRequest('Error, invalid context: ' + context)


def save_screenshot(request):
    if request.body:
        data = json.loads(request.body.decode("utf-8"))
        image = data['image']
        data['name'] = strip_non_ascii(data['name'])
        filename = os.path.join(
            settings.MEDIA_ROOT, 'thumbs', data['name'] + '.png')
        save_base64_to_file(filename, image)
        if hasattr(request.user, "username"):
            filename = os.path.join(
                settings.MEDIA_ROOT,
                'userthumbs',
                request.user.username + '--' + data['name'] + '.png')
            save_base64_to_file(filename, image)

        response = """{
            "type": "success",
            "msg" : "Obrázek byl úspěšně nahrán"
        }"""
        return HttpResponse(response, content_type='application/javascript')


def save_base64_to_file(filename, image):
    directory = os.path.dirname(filename)
    if not os.path.exists(directory):
        os.makedirs(directory)
    head = 'data:image/png;base64,'
    if head in image:
        image = image[len(head):]
        file_size = os.path.getsize(filename) if os.path.exists(filename) else 0
        image_encoded = base64.b64decode(image)
        if file_size < len(image_encoded):
            fh = open(filename, "wb")
            fh.write(image_encoded)
            fh.close()


def strip_non_ascii(string):
    ''' Returns the string without non ASCII characters'''
    stripped = (c for c in string if 0 < ord(c) < 127)
    return ''.join(stripped)


def has_active_subscription(request):
    return Subscription.objects.is_active(request.user, 'full')
