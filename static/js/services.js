'use strict';

/* Services */

angular.module('tour.services', []).

// Google Analytics
factory('analytics', ['$window',
    function(win) {
        const track = win.trackPageview || (function () {});
        return {
            trackView: track
        };
    }
]).

// Internationalization
factory('i18n', ['translation',
    function(translation) {
        return {
            l: function(key) {
                if (translation[key]) return translation[key];
                return '(no translation for ' + key + ')';
            }
        };
    }
]).

// Running code
factory('run', ['$window', 'editor',
    function(win, editor) {
        const writeInterceptor = function (writer, done) {
            return function (write) {
                if (write.Kind === 'stderr') {
                    const lines = write.Body.split('\n');
                    for (const i in lines) {
                        const match = lines[i].match(/.*\.go:([0-9]+): ([^\n]*)/);
                        if (match !== null) {
                            editor.highlight(match[1], match[2]);
                        }
                    }
                }
                writer(write);
                if (write.Kind === 'end') done();
            };
        };
        return function(code, output, options, done) {
            // PlaygroundOutput is defined in playground.js which is prepended
            // to the generated script.js in gotour/tour.go.
            // The next line removes the jshint warning.
            // global PlaygroundOutput
            return win.transport.Run(code, writeInterceptor(PlaygroundOutput(output), done), options);
        };
    }
]).

// Formatting code
factory('fmt', ['$http',
    function($http) {
        return function(body, imports) {
            const params = $.param({
                'body': body,
                'imports': imports,
            });
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            };
            return $http.post('/fmt', params, {
                headers: headers
            });
        };
    }
]).

// Local storage, persistent to page refreshing.
factory('storage', ['$window',
    function(win) {
        try {
            // This will raise an exception if cookies are disabled.
            win.localStorage = win.localStorage;
            return {
                get: function(key) {
                    return win.localStorage.getItem(key);
                },
                set: function(key, val) {
                    win.localStorage.setItem(key, val);
                }
            };
        } catch (e) {
            return {
                get: function() {
                    return null;
                },
                set: function() {}
            };
        }
    }
]).

// Editor context service, kept through the whole app.
// 默认开启高亮和导入
factory('editor', ['$window', 'storage',
    function(win, storage) {
        const ctx = {
            imports: storage.get('imports') ? storage.get('imports') : true,
            toggleImports: function () {
                ctx.imports = !ctx.imports;
                storage.set('imports', ctx.imports);
            },
            syntax: storage.get('syntax') ? storage.get('syntax') : true,
            toggleSyntax: function () {
                ctx.syntax = !ctx.syntax;
                storage.set('syntax', ctx.syntax);
                ctx.paint();
            },
            paint: function () {
                const mode = ctx.syntax && 'text/x-go' || 'text/x-go-comment';
                // Wait for codemirror to start.
                const set = function () {
                    if ($('.CodeMirror').length > 0) {
                        const cm = $('.CodeMirror')[0].CodeMirror;
                        if (cm.getOption('mode') === mode) {
                            cm.refresh();
                            return;
                        }
                        cm.setOption('mode', mode);
                    }
                    win.setTimeout(set, 10);
                };
                set();
            },
            highlight: function (line, message) {
                $('.CodeMirror-code > div:nth-child(' + line + ')')
                    .addClass('line-error').attr('title', message);
            },
            onChange: function () {
                $('.line-error').removeClass('line-error').attr('title', null);
            }
        };
        // Set in the window so the onChange function in the codemirror config
        // can call it.
        win.codeChanged = ctx.onChange;
        return ctx;
    }
]).

// Table of contents management and navigation
factory('toc', ['$http', '$q', '$log', 'tableOfContents', 'storage',
    function($http, $q, $log, tableOfContents, storage) {
        const modules = tableOfContents;

        let lessons = {};

        const prevLesson = function (id) {
            let mod = lessons[id].module;
            let idx = mod.lessons.indexOf(id);
            if (idx < 0) return '';
            if (idx > 0) return mod.lessons[idx - 1];

            idx = modules.indexOf(mod);
            if (idx <= 0) return '';
            mod = modules[idx - 1];
            return mod.lessons[mod.lessons.length - 1];
        };

        const nextLesson = function (id) {
            let mod = lessons[id].module;
            let idx = mod.lessons.indexOf(id);
            if (idx < 0) return '';
            if (idx + 1 < mod.lessons.length) return mod.lessons[idx + 1];

            idx = modules.indexOf(mod);
            if (idx < 0 || modules.length <= idx + 1) return '';
            mod = modules[idx + 1];
            return mod.lessons[0];
        };

        $http.get('/lesson/').then(
            function(data) {
                lessons = data.data;
                for (let m = 0; m < modules.length; m++) {
                    const module = modules[m];
                    module.lesson = {};
                    for (let l = 0; l < modules[m].lessons.length; l++) {
                        const lessonName = module.lessons[l];
                        const lesson = lessons[lessonName];
                        lesson.module = module;
                        module.lesson[lessonName] = lesson;

                        // replace file contents with locally stored copies.
                        for (let p = 0; p < lesson.Pages.length; p++) {
                            const page = lesson.Pages[p];
                            for (let f = 0; f < page.Files.length; f++) {
                                page.Files[f].OrigContent = page.Files[f].Content;
                                const val = storage.get(page.Files[f].Hash);
                                if (val !== null) {
                                    page.Files[f].Content = val;
                                }
                            }
                        }
                    }
                }
                moduleQ.resolve(modules);
                lessonQ.resolve(lessons);
            },
            function(error) {
                $log.error('error loading lessons : ', error);
                moduleQ.reject(error);
                lessonQ.reject(error);
            }
        );

        const moduleQ = $q.defer();
        const lessonQ = $q.defer();

        return {
            modules: moduleQ.promise,
            lessons: lessonQ.promise,
            prevLesson: prevLesson,
            nextLesson: nextLesson
        };
    }
]);
