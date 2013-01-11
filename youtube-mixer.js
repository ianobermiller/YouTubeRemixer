var defaultVideo = {
    title: '',
    url: '',
    thumbnailUrl: '',
    startTimeInMs: 0,
    endTimeInMs: 0,
    comments: []
};
var YouTubeMixer;
(function (YouTubeMixer) {
    var $search;
    var $searchResults;
    var $queue;
    var $playerCommentsContainer;
    var $comments;
    var $commentBox;
    var $playerComments;
    var $playerControls;
    var remix = {
        title: '',
        videos: []
    };
    var currentVideo = defaultVideo;
    var player;
    function init() {
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        $(function () {
            setupTemplateHelpers();
            bindElements();
            load({
                "title": "Foo Fighters Remix",
                "videos": [
                    {
                        "title": "Foo Fighters. Walk.",
                        "startTimeInMs": 1000,
                        "endTimeInMs": 60000,
                        "url": "https://www.youtube.com/v/4PkcfQtibmU?version=3&f=videos&app=youtube_gdata",
                        "thumbnailUrl": "http://i.ytimg.com/vi/4PkcfQtibmU/default.jpg",
                        "comments": [
                            {
                                "text": "wtf?",
                                "startTimeInMs": 1000,
                                "endTimeInMs": 2000,
                                "top": 200,
                                "left": 137,
                                "width": 79,
                                "height": 37
                            }, 
                            {
                                "text": "yay!",
                                "startTimeInMs": 4000,
                                "endTimeInMs": 9000,
                                "top": 110,
                                "left": 415,
                                "width": null,
                                "height": null
                            }, 
                            {
                                "text": "so cool guys except what about this super long comment that just goes on and on?!",
                                "startTimeInMs": 6000,
                                "endTimeInMs": 7000,
                                "top": 297,
                                "left": 520,
                                "width": null,
                                "height": null
                            }, 
                            {
                                "text": "get funky!",
                                "startTimeInMs": 17000,
                                "endTimeInMs": 19000,
                                "top": 105,
                                "left": 254,
                                "width": 138,
                                "height": 127
                            }
                        ]
                    }
                ]
            });
        });
    }
    YouTubeMixer.init = init;
    function bindElements() {
        $search = $('.search__input').keydown(function (e) {
            if(e.which === 13) {
                search();
            }
        });
        $searchResults = $('.search__results').hide().on('click', '.search__results__item', addVideo);
        $(document).click(function (e) {
            if(!$(e.target).closest('.search__results').length) {
                $searchResults.hide();
            }
        }).on('click', '.seek-to', seek);
        $queue = $('.queue').on('click', '.queue__item', onQueueItemClicked);
        $playerCommentsContainer = $('.player__comments').on('mouseenter click', '.player__comments__comment', setupDragAndResize);
        $playerControls = $('.player__controls').on('change', 'input', function (e) {
            var input = $(e.currentTarget);
            var index = $('.player__controls input').index(input);
            if(index == 0) {
                currentVideo.startTimeInMs = input.val();
            } else {
                currentVideo.endTimeInMs = input.val();
            }
        });
        $('.time-input').on('change', function (e) {
            var $input = $(e.currentTarget);
            $input.prev('.seek-to').data('time', $input.val());
        });
        $('.remix__title').on('change', function (e) {
            remix.title = $(e.currentTarget).val();
        });
        $comments = $('.comments__list').on('change', 'input', function (e) {
            var input = $(e.currentTarget);
            var index = $('.comments__list input').index(input);
            var comment = currentVideo.comments[Math.floor(index / 2)];
            if(index & 1) {
                comment.endTimeInMs = input.val();
            } else {
                comment.startTimeInMs = input.val();
            }
            toggleComments(getCurrentTime());
        }).on('change keyup', 'textarea', function (e) {
            var $textarea = $(e.currentTarget);
            var index = $('.comments__list textarea').index($textarea);
            var comment = currentVideo.comments[index];
            comment.text = $textarea.val();
            renderPlayerComments();
        }).on('click', '.comments__list__item__delete', function (e) {
            var $button = $(e.currentTarget);
            var index = $('.comments__list .comments__list__item__delete').index($button);
            currentVideo.comments.splice(index, 1);
            $button.closest('tr').fadeOut(function () {
                renderComments();
            });
        });
        $commentBox = $('.comments__input').keydown(function (e) {
            if(e.which === 13) {
                addComment(e);
            }
        });
        $('.comments__add').click(addComment);
    }
    function seek(e) {
        var time = Number($(e.currentTarget).data('time'));
        player.seekTo(time / 1000, true);
    }
    function setupDragAndResize(e) {
        var $item = $(e.currentTarget);
        if(!$item.is(':data(draggable)')) {
            $item.resizable({
                stop: function (e, ui) {
                    var c = currentVideo.comments[ui.element.index()];
                    c.width = ui.size.width;
                    c.height = ui.size.height;
                }
            }).draggable({
                containment: '.player__comments',
                stop: function (e, ui) {
                    var c = currentVideo.comments[ui.helper.index()];
                    c.top = ui.position.top;
                    c.left = ui.position.left;
                }
            });
        }
    }
    function onYouTubeIframeAPIReady() {
        player = new YT.Player('player__iframe', {
            height: 390,
            width: 640,
            origin: location.href,
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            },
            playerVars: {
                wmode: 'opaque'
            }
        });
    }
    YouTubeMixer.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
    function load(newRemix) {
        remix = newRemix;
        currentVideo = remix.videos[0] || defaultVideo;
        renderAll();
    }
    YouTubeMixer.load = load;
    function onPlayerReady(event) {
        setInterval(videoTick, 200);
        if(currentVideo) {
            loadVideo(currentVideo);
        }
    }
    function onPlayerStateChange(event) {
    }
    function renderAll() {
        $('.remix__title').val(remix.title);
        renderQueue();
        renderVideo();
    }
    function getCurrentTime() {
        if(!player || !player.getCurrentTime) {
            return 0;
        }
        return Math.floor(player.getCurrentTime() * 1000);
    }
    var queueTemplate;
    function renderQueue() {
        queueTemplate = queueTemplate || Handlebars.compile($('#queue-item-template').html());
        $queue.html(remix.videos.map(function (v) {
            return queueTemplate(v);
        }).join(''));
    }
    var currentVideoTemplate;
    function renderVideo() {
        currentVideoTemplate = currentVideoTemplate || Handlebars.compile($('#current-video-template').html());
        $playerControls.html(currentVideoTemplate(currentVideo));
        renderComments();
    }
    var playerCommentTemplate;
    function renderPlayerComments() {
        playerCommentTemplate = playerCommentTemplate || Handlebars.compile($('#player-comment-template').html());
        $playerCommentsContainer.html(currentVideo.comments.map(function (v) {
            return playerCommentTemplate(v);
        }).join(''));
        $playerComments = $('.player__comments__comment');
        toggleComments(getCurrentTime());
    }
    var commentListItemTemplate;
    function renderComments() {
        commentListItemTemplate = commentListItemTemplate || Handlebars.compile($('#comment-list-item-template').html());
        $comments.html(currentVideo.comments.map(function (v) {
            return commentListItemTemplate(v);
        }).join(''));
        renderPlayerComments();
    }
    var lastTime = null;
    function videoTick() {
        if(!player || !currentVideo) {
            return;
        }
        var currentTime = getCurrentTime();
        if(currentTime !== lastTime) {
            if(currentTime >= currentVideo.endTimeInMs) {
                player.pauseVideo();
            }
            toggleComments(currentTime);
            lastTime = currentTime;
        }
    }
    function toggleComments(timeInMs) {
        currentVideo.comments.forEach(function (c, i) {
            var isShown = timeInMs >= c.startTimeInMs && timeInMs <= c.endTimeInMs;
            var $comment = $playerComments.eq(i).toggle(isShown);
        });
    }
    function addVideo(e) {
        var video = $(e.currentTarget).data('video');
        if(!video) {
            throw new Error('Video does not exist.');
        }
        remix.videos.push(video);
        renderQueue();
    }
    function onQueueItemClicked(e) {
        var video = remix.videos[$(e.currentTarget).closest('.queue__item').index()];
        loadVideo(video);
    }
    function loadVideo(video) {
        if(!video) {
            throw new Error('Video does not exist.');
        }
        player.cueVideoByUrl(video.url, video.startTimeInMs / 1000);
        if(video !== currentVideo) {
            currentVideo = video;
            renderVideo();
        }
    }
    function addComment(e) {
        var text = $commentBox.val();
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
        currentVideo.comments.sort(function (a, b) {
            return a.startTimeInMs - b.startTimeInMs;
        });
        renderVideo();
        e.preventDefault();
    }
    function search() {
        var terms = encodeURIComponent($search.val());
        $.getJSON('https://gdata.youtube.com/feeds/api/videos?q=' + terms + '&alt=json-in-script&v=2&callback=?', {
        }, function (data) {
            var videos = data.feed.entry.map(function (entry) {
                console.log(entry);
                var video = {
                    title: entry.title.$t,
                    url: entry.content.src,
                    thumbnailUrl: entry.media$group.media$thumbnail.filter(function (t) {
                        return t.yt$name === 'default';
                    })[0].url,
                    comments: [],
                    startTimeInMs: 0,
                    endTimeInMs: entry.media$group.yt$duration.seconds * 1000
                };
                return video;
            });
            showSearchResults(videos);
        });
    }
    function showSearchResults(videos) {
        $searchResults.show();
        videos.forEach(function (video) {
            $('<li class="search__results__item"><img class="search__results__item__thumbnail" src="' + video.thumbnailUrl + '" /><span class="search__results__item__title">' + video.title + '</span></li>').data('video', video).appendTo($searchResults);
        });
    }
    var timeInputTemplate;
    function setupTemplateHelpers() {
        Handlebars.registerHelper('time_input', function (timeInMs) {
            timeInputTemplate = timeInputTemplate || Handlebars.compile($('#time-input-template').html());
            return new Handlebars.SafeString(timeInputTemplate({
                timeInMs: timeInMs
            }));
        });
    }
})(YouTubeMixer || (YouTubeMixer = {}));
function onYouTubeIframeAPIReady() {
    YouTubeMixer.onYouTubeIframeAPIReady();
}
