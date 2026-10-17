default:
	hugo --cleanDestinationDir 

up: default
	hugo server
push:
	rsync -avz --delete public/ nikkie@miceplans.net:~/pcyo.miceplans.net/
