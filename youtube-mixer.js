var defaultVideo = {
    title: '',
    url: '',
    thumbnailUrl: '',
    startTimeInMs: 0,
    endTimeInMs: 0,
    comments: []
};
function newRemix() {
    return {
        id: new Date().getTime().toString(),
        title: '',
        videos: []
    };
}
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
    var $remixTitle;
    var $remixList;
    var remix = newRemix();
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
        });
    }
    YouTubeMixer.init = init;
    function bindElements() {
        $search = $('.search__input').keydown(function (e) {
            if(e.which === 13) {
                search();
            }
        });
        $('.search__button').click(search);
        $searchResults = $('.search__results').hide().on('click', '.search__results__item', addVideo);
        $(document).click(function (e) {
            if(!$(e.target).closest('.search__results').length) {
                $searchResults.hide();
            }
        }).on('click', '.player__split', splitCurrentVideo);
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
        $(document).on('click', '.seek-to', seek).on('change', '.time-input', function (e) {
            var $input = $(e.currentTarget);
            $input.prev('.seek-to').data('time', $input.val());
        }).on('click', '.take-now', function (e) {
            var $button = $(e.currentTarget);
            $button.prev('.time-input').val(getCurrentTime()).trigger('change');
        });
        $remixList = $('.remix__list');
        $remixTitle = $('.remix__title').on('change', function (e) {
            remix.title = $(e.currentTarget).val();
        });
        $('.remix__save').on('click', function (e) {
            localStorage['remix-' + remix.id] = JSON.stringify(remix);
            renderRemixList();
        });
        $('.remix__load').on('click', function (e) {
            var key = $remixList.val();
            if(key) {
                load(JSON.parse(localStorage[key]));
            }
        });
        $('.remix__delete').on('click', function (e) {
            var key = $remixList.val();
            if(key) {
                localStorage.removeItem(key);
                renderRemixList();
            }
        });
        $('.remix__new').on('click', function (e) {
            load(newRemix());
        });
        renderRemixList();
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
    function splitCurrentVideo() {
        if(currentVideo) {
            var index = remix.videos.indexOf(currentVideo);
            var newVideo = _.extend({
            }, currentVideo);
            var current = getCurrentTime();
            currentVideo.endTimeInMs = current;
            newVideo.startTimeInMs = current;
            newVideo.comments = [];
            remix.videos.splice(index + 1, 0, newVideo);
            renderVideo();
            renderQueue();
        }
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
        loadVideo(remix.videos[0] || defaultVideo);
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
        $remixTitle.val(remix.title);
        renderQueue();
        renderVideo();
        renderComments();
    }
    function renderRemixList() {
        $remixList.empty();
        for(var key in localStorage) {
            if(key.indexOf('remix-') === 0) {
                var remix = JSON.parse(localStorage[key]);
                $remixList.append('<option value="' + key + '">' + remix.title + ' (' + key + ')</option>');
            }
        }
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
                if($('.queue__autoplay').is(':checked')) {
                    var index = remix.videos.indexOf(currentVideo);
                    if(index >= 0 && index < remix.videos.length - 1) {
                        loadVideo(remix.videos[index + 1]);
                    }
                }
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
            renderComments();
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
        renderComments();
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
            renderSearchResults(videos);
        });
    }
    var searchResultTemplate;
    function renderSearchResults(videos) {
        searchResultTemplate = searchResultTemplate || Handlebars.compile($('#search-result-template').html());
        $searchResults.empty().show();
        videos.forEach(function (video) {
            $(searchResultTemplate(video)).data('video', video).appendTo($searchResults);
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
