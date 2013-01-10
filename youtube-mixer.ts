/// <reference path="d.ts/handlebars-1.0.d.ts" />
/// <reference path="d.ts/jquery-1.8.d.ts" />
/// <reference path="d.ts/jqueryui-1.9.d.ts" />
/// <reference path="d.ts/youtube.d.ts" />

interface IRemix {
    videos: IVideo[];
}

interface IVideo {
    title: string;
    url: string;
    thumbnailUrl: string;
    comments: IComment[];
    startTimeInMs: number;
    endTimeInMs: number;
}

interface IComment {
    text: string;
    startTimeInMs: number;
    endTimeInMs: number;
    left: number;
    top: number;
    width: number;
    height: number;
}

var defaultVideo: IVideo = { title: '', url: '', thumbnailUrl: '', startTimeInMs: 0, endTimeInMs: 0, comments: [] };

module YouTubeMixer {
    var $search: JQuery;
    var $searchResults: JQuery;
    var $queue: JQuery;
    var $playerCommentsContainer: JQuery;
    var $comments: JQuery;
    var $commentBox: JQuery;
    var $playerComments: JQuery;
    var $playerControls: JQuery;

    var remix: IRemix = { videos: [] };
    var currentVideo: IVideo = defaultVideo;
    var player: YT.Player;

    export function init() {
        var tag: HTMLScriptElement = <any>document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        $(function () {
            setupTemplateHelpers();

            bindElements();

            load(<any>{ "videos": [{ "title": "Foo Fighters. Walk.", "startTimeInMs": 1000, "endTimeInMs": 60000, "url": "https://www.youtube.com/v/4PkcfQtibmU?version=3&f=videos&app=youtube_gdata", "thumbnailUrl": "http://i.ytimg.com/vi/4PkcfQtibmU/default.jpg", "comments": [{ "text": "wtf?", "startTimeInMs": 1000, "endTimeInMs": 2000, "top": 200, "left": 137, "width": 79, "height": 37 }, { "text": "yay!", "startTimeInMs": 4000, "endTimeInMs": 9000, "top": 110, "left": 415, "width": null, "height": null }, { "text": "so cool guys except what about this super long comment that just goes on and on?!", "startTimeInMs": 6000, "endTimeInMs": 7000, "top": 297, "left": 520, "width": null, "height": null }, { "text": "get funky!", "startTimeInMs": 17000, "endTimeInMs": 19000, "top": 105, "left": 254, "width": 138, "height": 127 }] }] });
        });
    }

    function bindElements(): void {
        
        // Search

        $search = $('.search__input')
            .keydown(e => {
                if (e.which === 13) search();
            });

        $searchResults = $('.search__results')
            .hide()
            .on('click', '.search__results__item', addVideo);

        $(document)
            .click(e => {
                if (!$(e.target).closest('.search__results').length) $searchResults.hide();
            })
            .on('click', '.seek-to', seek);

        // Queue

        $queue = $('.queue').on('click', '.queue__item', onQueueItemClicked);

        // Player

        $playerCommentsContainer = $('.player__comments')
            .on('mouseenter click', '.player__comments__comment', setupDragAndResize);

        $playerControls = $('.player__controls')
            .on('change', 'input', e => {
                var input = $(e.currentTarget);
                var index = $('.player__controls input').index(input);
                if (index == 0) {
                    currentVideo.startTimeInMs = input.val();
                } else {
                    currentVideo.endTimeInMs = input.val();
                }
            });

        $('.time-input').on('change', e => {
            var $input = $(e.currentTarget);
            $input.prev('.seek-to').data('time', $input.val());
        });

        // Coments

        $comments = $('.comments__list')
            .on('change', 'input', e => {
                var input = $(e.currentTarget);
                // Hacky way to do data binding
                // We know that each comment has two inputs, and that
                // the first is the start, and the second is the end time
                var index = $('.comments__list input').index(input);
                var comment = currentVideo.comments[Math.floor(index / 2)];
                if (index & 1) { // odd
                    comment.endTimeInMs = input.val();
                } else {
                    comment.startTimeInMs = input.val();
                }
            });
            
        $commentBox = $('.comments__input').keydown(e => {
            if (e.which === 13) addComment(e);
        });
    }

    function seek(e: JQueryEventObject): void {
        var time: number = Number($(e.currentTarget).data('time'));
        player.seekTo(time / 1000, true);
    }

    function setupDragAndResize(e: JQueryEventObject): void {
        var $item = $(e.currentTarget);
        if (!$item.is(':data(draggable)')) {
            $item.resizable({
                stop: (e, ui) => {
                    var c = currentVideo.comments[ui.element.index()];
                    c.width = ui.size.width;
                    c.height = ui.size.height;
                }
            }).draggable({
                containment: '.player__comments',
                stop: (e, ui) => {
                    var c = currentVideo.comments[ui.helper.index()];
                    c.top = ui.position.top;
                    c.left = ui.position.left;
                }
            });
        }
    }

    export function onYouTubeIframeAPIReady(): void {
        player = new YT.Player('player__iframe', {
            height: 390,
            width: 640,
            origin: location.href,
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            },
            playerVars: { wmode: 'opaque' }
        });
    }

    export function load(newRemix: IRemix): void {
        remix = newRemix;
        currentVideo = remix.videos[0] || defaultVideo;
        renderAll();
    }

    function onPlayerReady(event: YT.EventArgs): void {
        setInterval(videoTick, 200);
        if (currentVideo) loadVideo(currentVideo);
    }

    function onPlayerStateChange(event: YT.EventArgs): void {
    }

    function renderAll(): void {
        renderQueue();
        renderVideo();
    }

    function getCurrentTime(): number {
        if (!player || !player.getCurrentTime) return 0;
        return Math.floor(player.getCurrentTime() * 1000);
    }

    var queueTemplate;
    function renderQueue(): void {
        queueTemplate = queueTemplate || Handlebars.compile($('#queue-item-template').html());
        $queue.html(remix.videos.map(v => queueTemplate(v)).join(''));
    }
    
    var currentVideoTemplate;
    function renderVideo(): void {
        currentVideoTemplate = currentVideoTemplate || Handlebars.compile($('#current-video-template').html());
        $playerControls.html(currentVideoTemplate(currentVideo));

        renderComments();
    }

    var playerCommentTemplate;
    var commentListItemTemplate;
    function renderComments(): void {
        commentListItemTemplate = commentListItemTemplate || Handlebars.compile($('#comment-list-item-template').html());
        $comments.html(currentVideo.comments.map(v => commentListItemTemplate(v)).join(''));

        playerCommentTemplate = playerCommentTemplate || Handlebars.compile($('#player-comment-template').html());
        $playerCommentsContainer.html(currentVideo.comments.map(v => playerCommentTemplate(v)).join(''));
        $playerComments = $('.player__comments__comment');
        toggleComments(getCurrentTime());
    }

    var lastTime: number = null;
    function videoTick(): void {
        if (!player || !currentVideo) return;

        var currentTime = getCurrentTime();
        if (currentTime !== lastTime) {
            if (currentTime >= currentVideo.endTimeInMs) {
                player.pauseVideo();
            }
            toggleComments(currentTime);
            lastTime = currentTime;
        }
    }

    function toggleComments(timeInMs: number): void {
        currentVideo.comments.forEach((c, i) => {
            var isShown = timeInMs >= c.startTimeInMs && timeInMs <= c.endTimeInMs;
            var $comment = $playerComments.eq(i).toggle(isShown);
        });
    }

    function addVideo(e: JQueryEventObject): void {
        var video: IVideo = $(e.currentTarget).data('video');
        if (!video) throw new Error('Video does not exist.');
        remix.videos.push(video);
        renderQueue();
    }

    function onQueueItemClicked(e: JQueryEventObject): void {
        var video: IVideo = remix.videos[$(e.currentTarget).closest('.queue__item').index()];
        loadVideo(video);
    }

    function loadVideo(video: IVideo): void {
        if (!video) throw new Error('Video does not exist.');
        player.cueVideoByUrl(video.url, video.startTimeInMs / 1000);
        if (video !== currentVideo) {
            currentVideo = video;
            renderVideo();
        }
    }

    function addComment(e: JQueryEventObject): void {
        var text: string = $commentBox.val();
        $commentBox.val('');
        var time = Math.floor(getCurrentTime() / 1000) * 1000;
        currentVideo.comments.push({
            text: text,
            startTimeInMs: time,
            endTimeInMs: time + 3000,
            top: 0,
            left: 0,
            width: 100,
            height: 20
        });
        currentVideo.comments.sort((a, b) => a.startTimeInMs - b.startTimeInMs);
        renderVideo();
        e.preventDefault();
    }

    function search(): void {
        var terms = encodeURIComponent($search.val());
        $.getJSON('https://gdata.youtube.com/feeds/api/videos?q=' + terms + '&alt=json-in-script&v=2&callback=?', {}, function (data) {
            var videos = data.feed.entry.map(entry => {
                console.log(entry);
                var video: IVideo = {
                    title: entry.title.$t,
                    url: entry.content.src,
                    thumbnailUrl: entry.media$group.media$thumbnail.filter(function (t) { return t.yt$name === 'default'; })[0].url,
                    comments: [],
                    startTimeInMs: 0,
                    endTimeInMs: entry.media$group.yt$duration.seconds * 1000
                };
                return video;
            });
            showSearchResults(videos);
        });
    }

    function showSearchResults(videos: IVideo[]): void {
        $searchResults.show();
        videos.forEach(video => {
            $('<li class="search__results__item"><img class="search__results__item__thumbnail" src="' + video.thumbnailUrl + '" /><span class="search__results__item__title">' + video.title + '</span></li>').data('video', video).appendTo($searchResults);
        });
    }
    
    var timeInputTemplate;
    function setupTemplateHelpers() {
        Handlebars.registerHelper('time_input', function(timeInMs: number) {
            timeInputTemplate = timeInputTemplate || Handlebars.compile($('#time-input-template').html());
            return new Handlebars.SafeString(timeInputTemplate({ timeInMs: timeInMs }));
        });
    }
}

function onYouTubeIframeAPIReady() {
    YouTubeMixer.onYouTubeIframeAPIReady();
}