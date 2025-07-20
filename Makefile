default:
	hugo && rsync -avz --delete public/ nikkie@miceplans.net:~/pcyo.miceplans.net/
