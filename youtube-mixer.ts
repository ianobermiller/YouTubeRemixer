/// <reference path="d.ts/handlebars-1.0.d.ts" />
/// <reference path="d.ts/jquery-1.8.d.ts" />
/// <reference path="d.ts/jqueryui-1.9.d.ts" />
/// <reference path="d.ts/underscore-typed-1.4.d.ts" />
/// <reference path="d.ts/youtube.d.ts" />

interface IRemix {
    id: string;
    title: string;
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

function newRemix(): IRemix {
    return { id: new Date().getTime().toString(), title: '', videos: [] };
}

module YouTubeMixer {
    var $search: JQuery;
    var $searchResults: JQuery;
    var $queue: JQuery;
    var $playerCommentsContainer: JQuery;
    var $comments: JQuery;
    var $commentBox: JQuery;
    var $playerComments: JQuery;
    var $playerControls: JQuery;
    var $remixTitle: JQuery;
    var $remixList: JQuery;

    var remix = newRemix();
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

            //load(<any>{ "id": "0", "title": "Foo Fighters Remix", "videos": [{ "title": "Foo Fighters. Walk.", "startTimeInMs": 1000, "endTimeInMs": 60000, "url": "https://www.youtube.com/v/4PkcfQtibmU?version=3&f=videos&app=youtube_gdata", "thumbnailUrl": "http://i.ytimg.com/vi/4PkcfQtibmU/default.jpg", "comments": [{ "text": "wtf?", "startTimeInMs": 1000, "endTimeInMs": 2000, "top": 200, "left": 137, "width": 79, "height": 37 }, { "text": "yay!", "startTimeInMs": 4000, "endTimeInMs": 9000, "top": 110, "left": 415, "width": null, "height": null }, { "text": "so cool guys except what about this super long comment that just goes on and on?!", "startTimeInMs": 6000, "endTimeInMs": 7000, "top": 297, "left": 520, "width": null, "height": null }, { "text": "get funky!", "startTimeInMs": 17000, "endTimeInMs": 19000, "top": 105, "left": 254, "width": 138, "height": 127 }] }] });
        });
    }

    function bindElements(): void {
        
        // Search

        $search = $('.search__input')
            .keydown(e => {
                if (e.which === 13) search();
            });
        $('.search__button').click(search);

        $searchResults = $('.search__results')
            .hide()
            .on('click', '.search__results__item', addVideo);

        $(document)
            .click(e => {
                if (!$(e.target).closest('.search__results').length) $searchResults.hide();
            })
            .on('click', '.player__split', splitCurrentVideo);

        // Queue

        $queue = $('.queue').on('click', '.queue__item', onQueueItemClicked);

        // Player

        $playerCommentsContainer = $('.player__comments')
            .click(e => {
                if (player && player.getPlayerState() !== YT.PlayerState.PLAYING) {
                    player.playVideo();
                } else if (player) {
                    player.pauseVideo();
                }
            })
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
        
        // Shared

        $(document)
            .on('click', '.seek-to', seek)
            .on('change', '.time-input', e => {
                var $input = $(e.currentTarget);
                $input.prev('.seek-to').data('time', $input.val());
            })
            .on('click', '.take-now', e => {
                var $button = $(e.currentTarget);
                $button.prev('.time-input').val(getCurrentTime()).trigger('change');
            });

        // Remix

        $remixList = $('.remix__list');

        $remixTitle = $('.remix__title').on('change', e => {
            remix.title = $(e.currentTarget).val();
        });

        $('.remix__save').on('click', e => {
            localStorage['remix-' + remix.id] = JSON.stringify(remix);
            renderRemixList();
        });

        $('.remix__load').on('click', e => {
            var key = $remixList.val();
            if (key) {
                load(JSON.parse(localStorage[key]));
            }
        });

        $('.remix__delete').on('click', e => {
            var key = $remixList.val();
            if (key) {
                localStorage.removeItem(key);
                renderRemixList();
            }
        });

        $('.remix__new').on('click', e => {
            load(newRemix());
        });

        renderRemixList();

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
                toggleComments(getCurrentTime());
            })
            .on('change keyup', 'textarea', e => {
                var $textarea = $(e.currentTarget);
                var index = $('.comments__list textarea').index($textarea);
                var comment = currentVideo.comments[index];
                comment.text = $textarea.val();
                renderPlayerComments();
            })
            .on('click', '.comments__list__item__delete', e => {
                var $button = $(e.currentTarget);
                var index = $('.comments__list .comments__list__item__delete').index($button);
                currentVideo.comments.splice(index, 1);
                $button.closest('tr').fadeOut(() => {
                    renderComments();
                });
            });
            
        $commentBox = $('.comments__input').keydown(e => {
            if (e.which === 13) addComment(e);
        });

        $('.comments__add').click(addComment);
    }

    function splitCurrentVideo(): void {
        if (currentVideo) {
            var index = remix.videos.indexOf(currentVideo);
            var newVideo: IVideo = _.extend({}, currentVideo);
            var current = getCurrentTime();
            currentVideo.endTimeInMs = current;
            newVideo.startTimeInMs = current;
            newVideo.comments = [];
            remix.videos.splice(index + 1, 0, newVideo);
            renderVideo();
            renderQueue();
        }
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
        loadVideo(remix.videos[0] || defaultVideo);
        renderAll();
    }

    function onPlayerReady(event: YT.EventArgs): void {
        setInterval(videoTick, 200);
        if (currentVideo) loadVideo(currentVideo);
    }

    function onPlayerStateChange(event: YT.EventArgs): void {
    }

    function renderAll(): void {
        $remixTitle.val(remix.title);
        renderQueue();
        renderVideo();
        renderComments();
    }

    function renderRemixList(): void {
        $remixList.empty();
        for (var key in localStorage) {
            if (key.indexOf('remix-') === 0) {
                var remix: IRemix = JSON.parse(localStorage[key]);
                $remixList.append('<option value="' + key + '">' + remix.title + ' (' + key + ')</option>');
            }
        }
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
    }

    var playerCommentTemplate;
    function renderPlayerComments(): void {
        playerCommentTemplate = playerCommentTemplate || Handlebars.compile($('#player-comment-template').html());
        $playerCommentsContainer.html(currentVideo.comments.map(v => playerCommentTemplate(v)).join(''));
        $playerComments = $('.player__comments__comment');
        toggleComments(getCurrentTime());
    }
    
    var commentListItemTemplate;
    function renderComments(): void {
        commentListItemTemplate = commentListItemTemplate || Handlebars.compile($('#comment-list-item-template').html());
        $comments.html(currentVideo.comments.map(v => commentListItemTemplate(v)).join(''));

        renderPlayerComments();
    }

    var lastTime: number = null;
    function videoTick(): void {
        if (!player || !currentVideo) return;

        var currentTime = getCurrentTime();
        if (currentTime !== lastTime) {
            if (currentTime >= currentVideo.endTimeInMs && player.getPlayerState() === YT.PlayerState.PLAYING) {
                player.pauseVideo();
                if ($('.queue__autoplay').is(':checked')) {
                    var index = remix.videos.indexOf(currentVideo);
                    if (index >= 0 && index < remix.videos.length - 1) {
                        loadVideo(remix.videos[index + 1]);
                    }
                }
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
            renderComments();
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
        renderComments();
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
            renderSearchResults(videos);
        });
    }
    
    var searchResultTemplate;
    function renderSearchResults(videos: IVideo[]): void {
        searchResultTemplate = searchResultTemplate || Handlebars.compile($('#search-result-template').html());
        $searchResults.empty().show();
        videos.forEach(video => {
            $(searchResultTemplate(video)).data('video', video).appendTo($searchResults);
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