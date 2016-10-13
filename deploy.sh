#!/bin/sh
# deployment script run by Viper server after push

echo "Starting deploy script"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd $DIR

#requirements
pip install -r $DIR/requirements.txt

# database
python $DIR/manage.py migrate --noinput
python $DIR/manage.py compilemessages
python $DIR/manage.py load_user_questions $DIR/data/user-questions.json
python $DIR/manage.py load_configab_experiments $DIR/ab_experiments.json
python $DIR/manage.py load_subscription_plans $DIR/plans.json

cd $DIR/anatomy
npm install --python=/usr/bin/python2.7
grunt --verbose
cd $DIR

# static files
python $DIR/manage.py collectstatic --noinput
