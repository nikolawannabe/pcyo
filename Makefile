.PHONY: default clean up push

default: clean
	hugo --gc

clean:
	rm -rf public resources/_gen

up: default
	hugo server --disableFastRender
