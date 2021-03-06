/**
 * Stuff that runs on every page, not just the dabblet app
 */
 
var gist = {
	clientId: 'da931d37076424f332ef',
	
	oauth: [
		// Step 1: Ask permission
		function(callback){
			gist.oauth.callback = callback;
			
			var popup = open('https://github.com/login/oauth/authorize' + 
				'?client_id=' + gist.clientId +
				'&scope=gist,user', 'popup', 'width=1015,height=500');
		},
		// Step 2: Get access token and store it
		function(token){
			if(token) {
				window.ACCESS_TOKEN = localStorage['access_token'] = token;
				
				gist.getUser(gist.oauth.callback);
				
			}
			else {
				alert('Authentication error');
			}
			
			gist.oauth.callback = null;
		}
	],
	
	request: function(o) {
		o.method = o.method || 'GET';
		o.id = o.id || '';
		o.rev = o.rev || '';
		o.accepted = o.accepted || [];
		
		var anon = o.anon || o.method === 'GET';
		
		if(!anon && !window.ACCESS_TOKEN) {
			gist.oauth[0](function(){
				gist.request(o);
			});
			return;
		}
		
		var path = o.path || 'gists' +
				(o.id? '/' + o.id : '') +
				(o.rev? '/' + o.rev : '') +
				(o.gpath || '');
		
		$u.xhr({
			method: o.method,
			url: 'https://api.github.com/' + path + (!o.anon && window.ACCESS_TOKEN? '?access_token=' + ACCESS_TOKEN : ''),
			headers: o.headers,
			callback: function(xhr) {				
				var data = xhr.responseText? JSON.parse(xhr.responseText) : null;
				
				if (data && data.message && o.accepted.indexOf(xhr.status) === -1) {
					alert('Sorry, I got a ' + xhr.status + ' (' + data.message + ')');
				}
				else {
					o.callback && o.callback(data, xhr);
				}
			},
			data: o.data? JSON.stringify(o.data) : null
		});
	},
	
	getUser: function(callback) {
		gist.request({
			path: 'user',
			callback: function(data) {
				window.user = data;
				
				document.documentElement.classList.add('logged-in');
				
				$u.event.fire(window, 'gotUserInfo');
				
				callback && callback(data);
			}
		});
	},
	
	getUserHTML: function(user) {
		return '<img src="' + user.avatar_url + '">' + (user.name || user.login);
	},
	
	getUserURL: function(user) {
		return '/user/' + user.login;
	},
	
	save: function(options){
		options = options || {};
		
		var anonymous = options.anon || !window.user;
		
		if(gist.id 
		&& (!gist.user || !window.user || gist.user.id != user.id)
		&& !anonymous
		) {
			// If it doesn't belong to current user, fork first
			gist.fork(gist.id, gist.save, options.anon);
			return;
		}
		
		var id = gist.id || '',
			cssCode = css.textContent,
			htmlMarkup = html.textContent,
			title = Dabblet.title(cssCode);
			
		gist.request({
			anon: options.anon,
			id: anonymous || options.forceNew? null : id,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=UTF-8'
			},
			callback: function(data, xhr) {
				if(data.id) {
					gist.update(data);
				}
			},
			data: {
				"description": title,
				"public": true,
				"files": {
					"dabblet.css": {
						"content": cssCode
					},
					"dabblet.html": htmlMarkup? {
						"content": htmlMarkup
					} : null,
					"settings.json": {
						"content": JSON.stringify(Dabblet.settings.current(null, 'file'))
					}
				}
			}
		});
	},
	
	fork: function(id, callback, anon) {
		gist.request({
			method: 'POST',
			gpath: '/fork',
			id: id || gist.id || null,
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8'
			},
			callback: function(data, xhr) {
				if(data.id) {
					gist.update(data);
					
					callback && callback();
				}
			},
			data: {}	
		});
	},
	
	load: function(id, rev){
		gist.request({
			id: id || gist.id,
			rev: rev || gist.rev,
			callback: function(data){
				gist.update(data);
				
				var files = data.files;
				
				var cssFile = files['dabblet.css'],
					htmlFile = files['dabblet.html'],
					settings = files['settings.json'];

				if(!cssFile || !htmlFile) {
					for(var filename in files) {
						var ext = filename.slice(filename.lastIndexOf('.'));
						
						if(!cssFile && ext == '.css') {
							cssFile = files[filename];
						}

						if(!htmlFile && ext == '.html') {
							htmlFile = files[filename];
						}
						
						if(cssFile && htmlFile) {
							break;
						}
					}
				}
				
				if(htmlFile) {
					html.textContent = htmlFile.content;
					html.onkeyup();
				}
				
				if(cssFile) {
					css.textContent = cssFile.content;
					css.onkeyup();
				}
				
				var defaultSettings = Dabblet.settings.current();
				
				if(typeof localStorage.settings === 'string') {
					defaultSettings = $u.merge(defaultSettings, JSON.parse(localStorage.settings));
				}
				
				if(settings) {
					try { settings = JSON.parse(settings.content); }
					catch(e) { settings = {}; }
				}
				else {
					settings = {};
				}
				
				Dabblet.settings.apply($u.merge(defaultSettings, settings));
			}
		});
	},
	
	update: function(data) {
		var id = data.id,
			rev = data.history && data.history[0].version || '';
		
		if(gist.id != id) {
			gist.id = id;
			gist.rev = undefined;
			
			history.pushState(null, '', '/gist/' + id + location.search + location.hash);
		}
		else if(gist.rev && gist.rev !== rev) {
			gist.rev = rev;

			history.pushState(null, '', '/gist/' + id + '/' + rev + location.search + location.hash);
		}
		
		if(data.user) {
			gist.user = data.user;
		}
		
		var gistUser = window['gist-user'];
		if(gist.user && gist.user != window.user) {
			gistUser.innerHTML = gist.getUserHTML(gist.user);
			gistUser.href = gist.getUserURL(gist.user);
			gistUser.removeAttribute('aria-hidden');
		}
		else {
			gistUser.setAttribute('aria-hidden', 'true');
		}
		
		$$('a[data-href*="{gist-id}"]').forEach(function(a) {
			a.href = a.getAttribute('data-href')
						.replace(/\{gist-id\}/gi, id)
						.replace(/\{gist-rev\}/gi, rev);
			a.removeAttribute('data-disabled');
			a.removeAttribute('aria-hidden');
		});
		
		gist.saved = true;
	},
	
	_saved: true
};

Object.defineProperty(gist, 'saved', {
	get: function() {
		return this._saved;
	},
	
	set: function(saved) {
		saved = !!saved;
		
		if(saved === this._saved) {
			return;
		}
		
		this._saved = saved;
		
		if(saved) {
			document.body.removeAttribute('data-unsaved');
			window['save-cmd'].setAttribute('data-disabled', '');
		}
		else {
			document.body.setAttribute('data-unsaved', '');
			
			if(window.user) {
				window['save-cmd'].removeAttribute('data-disabled');
			}
		}
	}
});

var Dabblet = {
	version: '1.0.6',
	
	user: {
		login: function() {
			gist.oauth[0](function(user){
				Dabblet.user.afterLogin(user);
			});
		},
		
		afterLogin: function(user){
			var login = user.login;
			
			if(window.currentuser) {
				currentuser.innerHTML = gist.getUserHTML(user);
				currentuser.href = gist.getUserURL(user);
				currentuser.parentNode.className = currentuser.parentNode.className.replace('-inactive-', '-');
				$('.my-profile').href = '/user/' + user.login;
			}
			
			if(window['save-button']) {
				window['save-button'].onclick = window['save-cmd'].onclick = gist.save;
				window['save-cmd'].removeAttribute('data-disabled');
				window['save-new-cmd'].removeAttribute('data-disabled');
			}
		},
		
		logout: function() {
			if(confirm('Are you sure you want to log out?')) {
				localStorage.removeItem('access_token');
			}
		}
	}
};

window.ACCESS_TOKEN = localStorage['access_token'];

currentuser.onclick = function(){
	if(!this.hasAttribute('href')) {
		Dabblet.user.login();
	}
}

// Add loader to the page
if(!$('#loader')) {
	$u.element.create('div', {
		properties: { id: 'loader' },
		inside: 'body'
	});
}

document.addEventListener('DOMContentLoaded', function() {
	if(ACCESS_TOKEN) {
		gist.getUser(function(user){
			Dabblet.user.afterLogin(user);
		});
	}
});

// If only :focus and :checked bubbled...
(function() {
	function ancestorClass(action, className, element) {
		var ancestor = element;
		
		do {
			ancestor = ancestor.parentNode;
			ancestor.classList[action](className)
		} while(ancestor && ancestor != document.body);
	}
	
	$u.event.bind('header a, header input, header button, header [tabindex="0"], pre', {
		focus: function(){
			ancestorClass('add', 'focus', this);
		},
		
		blur: function() {
			ancestorClass('remove', 'focus', this);
		}
	});
})();
