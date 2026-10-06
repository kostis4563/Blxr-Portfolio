import { navigate, projectPath, libraryPath, blogPath, HOME_PATH, PROJECTS_PATH, LIBRARY_PATH, BLOG_PATH, REVIEWS_PATH, WRITE_REVIEW_PATH, USES_PATH, CV_PATH, CONTACT_PATH, DASHBOARD_PATH, LOGIN_PATH, dashboardPath } from './router'
import { authSignOut, loginUrlFor } from './auth'
import { projectsList } from './projects'
import { libraryList } from './library'
import { postsList } from './blog'
import { SECTIONS, jumpToSection } from './palette'
import { fold } from './text-match'
import { CONTACT_EMAIL, SOCIALS } from './profile'
import { SITE_NAME, SITE_URL } from './seo'
import {
  startCommenting,
  toggleCommentsHidden,
  focusComment,
  clearComments,
  restoreComments,
  commentsOn,
  commentsMarkdown,
  shortAgo,
} from './comments'
import { toast } from './figma'

export const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'pages', label: 'Pages' },
  { id: 'projects', label: 'Projects' },
  { id: 'library', label: 'Library' },
  { id: 'actions', label: 'Actions' },
  { id: 'comments', label: 'Comments' },
]

const SCOPE_OF_GROUP = {
  'Jump to': 'pages',
  Projects: 'projects',
  'FiveM Library': 'library',
  Blog: 'pages',
  Actions: 'actions',
  Links: 'actions',
  Comments: 'comments',
  'Your comments': 'comments',
}

export const inScope = (command, scope) => scope === 'all' || command.scope === scope

const firstLine = (text, max = 64) => {
  const line = text.trim().split('\n')[0]
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function commentCommands({ comments, commentsHidden, path, pageName }) {
  const group = 'Comments'
  const here = commentsOn(comments, path)
  const resolved = here.filter((c) => c.resolved)
  const undo = (gone, what) =>
    toast(what, '', { label: 'Undo', run: () => restoreComments(gone) })

  return [
    {
      id: 'comment-add',
      group,
      label: 'Add a comment',
      hint: 'Only saved in this browser',
      icon: 'message',
      shortcut: ['/'],
      run: startCommenting,
      keywords: 'comment note annotate pin feedback figma',
    },
    (comments.length > 0 || commentsHidden) && {
      id: 'comment-toggle',
      group,
      label: commentsHidden ? 'Show comments' : 'Hide comments',
      hint: here.length ? `${here.length} on this page` : '',
      icon: 'eye',
      shortcut: ['⇧', 'C'],
      run: () => {
        toggleCommentsHidden()
        toast(commentsHidden ? 'Comments shown' : 'Comments hidden', '⇧C')
      },
      keywords: 'comments toggle hide show visibility',
    },
    comments.length > 0 && {
      id: 'comment-copy',
      group,
      label: 'Copy all comments as Markdown',
      hint: `${comments.length} total`,
      icon: 'copy',
      verb: 'Copy',
      run: () => navigator.clipboard?.writeText(commentsMarkdown(comments, SITE_URL)).catch(() => {}),
      flash: 'Copied',
      keywords: 'comments export markdown clipboard notes',
    },
    resolved.length > 0 && {
      id: 'comment-clear-resolved',
      group,
      label: 'Delete resolved comments on this page',
      hint: `${resolved.length} resolved`,
      icon: 'trash',
      run: () => undo(clearComments(path, { resolvedOnly: true }), 'Resolved comments deleted'),
      keywords: 'comments clear clean resolved delete',
    },
    here.length > 0 && {
      id: 'comment-clear',
      group,
      label: 'Delete all comments on this page',
      hint: `${here.length} on ${pageName(path)}`,
      icon: 'trash',
      run: () => undo(clearComments(path), 'Comments deleted'),
      keywords: 'comments clear delete remove reset',
    },
    ...comments
      .slice()
      .reverse()
      .map((c) => ({
        id: `comment-${c.id}`,
        group: 'Your comments',
        label: firstLine(c.text),
        hint: `${pageName(c.path)} · ${shortAgo(c.at)}${c.resolved ? ' · resolved' : ''}`,
        icon: 'message',
        verb: 'Open',
        where: c.path,
        run: () => {
          if (c.path !== path) navigate(c.path)
          focusComment(c.id)
        },
        keywords: `comment ${c.text} ${c.path}`,
      })),
  ]
}

export function buildCommands({
  theme,
  toggleTheme,
  toggleGrid,
  signedIn = false,
  comments = [],
  commentsHidden = false,
  path = HOME_PATH,
}) {
  const jump = 'Jump to'
  const actions = 'Actions'
  const links = 'Links'
  const projects = 'Projects'

  const commands = [
    {
      id: 'page-home',
      group: jump,
      label: 'Home',
      icon: 'home',
      href: HOME_PATH,
      run: () => navigate(HOME_PATH),
    },
    {
      id: 'page-projects',
      group: jump,
      label: 'Projects Archive',
      hint: `${projectsList.length} projects`,
      icon: 'archive',
      href: PROJECTS_PATH,
      run: () => navigate(PROJECTS_PATH),
    },
    {
      id: 'page-library',
      group: jump,
      label: 'FiveM Library',
      hint: `${libraryList.length} resources`,
      icon: 'archive',
      href: LIBRARY_PATH,
      run: () => navigate(LIBRARY_PATH),
      keywords: 'fivem library ui script hud nui lua',
    },
    {
      id: 'page-blog',
      group: jump,
      label: 'Blog',
      hint: postsList.length ? `${postsList.length} post${postsList.length === 1 ? '' : 's'}` : 'Writing',
      icon: 'pencil',
      href: BLOG_PATH,
      run: () => navigate(BLOG_PATH),
      keywords: 'blog posts writing articles notes journal rss',
    },
    {
      id: 'page-reviews',
      group: jump,
      label: 'Reviews',
      hint: 'Feedback',
      icon: 'star',
      href: REVIEWS_PATH,
      run: () => navigate(REVIEWS_PATH),
      keywords: 'reviews testimonials feedback rating stars',
    },
    {
      id: 'page-uses',
      group: jump,
      label: 'Uses',
      hint: 'uses',
      icon: 'monitor',
      href: USES_PATH,
      run: () => navigate(USES_PATH),
      keywords: 'uses setup gear stack editor machine laptop terminal fonts hosting music tools software hardware',
    },
    {
      id: 'page-cv',
      group: jump,
      label: 'CV',
      hint: 'Curriculum vitae',
      icon: 'file',
      href: CV_PATH,
      run: () => navigate(CV_PATH),
      keywords: 'cv resume résumé curriculum vitae experience education skills certifications print pdf',
    },
    {
      id: 'page-contact',
      group: jump,
      label: 'Contact',
      hint: 'Get in touch',
      icon: 'mail',
      href: CONTACT_PATH,
      run: () => navigate(CONTACT_PATH),
      keywords: 'contact email reach hire freelance discord github socials',
    },

    ...SECTIONS.map((section) => ({
      id: `section-${section.id}`,
      group: jump,
      label: section.label,
      icon: 'section',
      href: `${HOME_PATH}#${section.id}`,
      run: () => jumpToSection(section.id),
    })),

    ...projectsList.map((project) => ({
      id: `project-${project.id}`,
      group: projects,
      label: project.title,
      hint: project.category,
      icon: 'project',
      accent: project.accent,
      href: projectPath(project.id),
      run: () => navigate(projectPath(project.id)),

      keywords: `${project.tags.join(' ')} ${project.shortDescription}`,
    })),

    ...libraryList
      .filter((entry) => !entry.placeholder)
      .map((entry) => ({
        id: `library-${entry.id}`,
        group: 'FiveM Library',
        label: entry.title,
        hint: entry.category,
        icon: 'project',
        accent: entry.accent,
        href: libraryPath(entry.id),
        run: () => navigate(libraryPath(entry.id)),
        keywords: `fivem ${entry.tags.join(' ')} ${entry.shortDescription}`,
      })),

    ...postsList.map((post) => ({
      id: `post-${post.slug}`,
      group: 'Blog',
      label: post.title,
      hint: `${post.minutes} min read`,
      icon: 'file',
      href: blogPath(post.slug),
      run: () => navigate(blogPath(post.slug)),
      keywords: `blog post ${post.tags.join(' ')} ${post.description}`,
    })),

    {
      id: 'action-theme',
      group: actions,

      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: theme === 'dark' ? 'sun' : 'moon',
      run: toggleTheme,
      keywords: 'theme dark light',
    },
    toggleGrid && {
      id: 'action-grid',
      group: actions,
      label: 'Toggle layout grid',
      icon: 'layout',
      shortcut: ['⇧', 'G'],
      run: toggleGrid,
      keywords: 'grid columns layout guides figma',
    },
    {
      id: 'action-copy-link',
      group: actions,
      label: 'Copy link to this page',
      icon: 'link',
      verb: 'Copy',
      run: () => navigator.clipboard?.writeText(window.location.href).catch(() => {}),
      flash: 'Copied',
      keywords: 'share url link copy',
    },
    {
      id: 'action-write-review',
      group: actions,
      label: 'Write a review',
      icon: 'star',
      href: WRITE_REVIEW_PATH,
      run: () => navigate(WRITE_REVIEW_PATH),
      keywords: 'review testimonial feedback rate',
    },
    signedIn
      ? {
          id: 'page-dashboard',
          group: jump,
          label: 'Dashboard',
          icon: 'grid',
          href: DASHBOARD_PATH,
          run: () => navigate(DASHBOARD_PATH),
          keywords: 'dashboard account profile settings',
        }
      : {
          id: 'action-sign-in',
          group: actions,
          label: 'Sign in',
          hint: 'Or contact me through the dashboard',
          icon: 'user',
          href: loginUrlFor(DASHBOARD_PATH),
          run: () => navigate(loginUrlFor(DASHBOARD_PATH)),
          keywords: 'login sign in account register',
        },
    {
      id: 'action-send-message',
      group: actions,
      label: 'Send me a message',
      icon: 'message',
      href: dashboardPath('messages'),
      run: () => navigate(dashboardPath('messages')),
      keywords: 'contact message chat dm write talk',
    },
    signedIn && {
      id: 'action-sign-out',
      group: actions,
      label: 'Sign out',
      icon: 'logout',
      run: () => authSignOut().then(() => navigate(LOGIN_PATH, { replace: true })),
      keywords: 'logout sign out',
    },
    {
      id: 'action-copy-email',
      group: actions,
      label: 'Copy email address',
      hint: CONTACT_EMAIL,
      icon: 'copy',
      verb: 'Copy',

      run: () => navigator.clipboard?.writeText(CONTACT_EMAIL).catch(() => {}),
      flash: 'Copied',
    },

    ...SOCIALS.filter((social) => social.url).map((social) => ({
      id: `link-${social.name.toLowerCase()}`,
      group: links,
      label: social.name,
      hint: social.handle,
      icon: social.name.toLowerCase(),
      href: social.url,
      external: true,
    })),
    {
      id: 'link-email',
      group: links,
      label: 'Send an email',
      hint: CONTACT_EMAIL,
      icon: 'mail',
      href: `mailto:${CONTACT_EMAIL}`,
      external: true,
    },
  ]

  const pageName = (to) => commands.find((c) => c && c.group === jump && c.href === to)?.label ?? to
  commands.push(...commentCommands({ comments, commentsHidden, path, pageName }))

  return commands.filter(Boolean).map((command) => ({
    ...command,
    scope: SCOPE_OF_GROUP[command.group],
    verb: command.verb || (command.external ? 'Visit' : command.href ? 'Open' : 'Run'),
    fLabel: fold(command.label),
    haystack: fold([command.label, command.hint || '', command.group, command.keywords || ''].join(' ')),
  }))
}

export function recentCommands(commands, paths, { exclude = null, limit = 4 } = {}) {
  const byHref = new Map()
  for (const command of commands) {
    if (command.href && !command.external && !byHref.has(command.href)) byHref.set(command.href, command)
  }
  return paths
    .filter((path) => path !== exclude)
    .map((path) => byHref.get(path))
    .filter(Boolean)
    .slice(0, limit)
    .map((command) => ({ ...command, id: `recent-${command.id}`, group: 'Recent' }))
}

export function sudoCommand(query) {
  const typed = query.trim().replace(/\s+/g, ' ')
  if (!/^sudo\b/i.test(typed)) return null
  return {
    id: 'action-sudo',
    group: 'Terminal',
    label: /^sudo$/i.test(typed) ? `sudo hire ${SITE_NAME}` : typed,
    hint: 'Run as root',
    icon: 'terminal',
    shell: true,
  }
}

export function rankCommands(commands, query) {
  const q = fold(query.trim())
  if (!q) return commands

  const hits = []
  for (const command of commands) {
    if (command.fLabel.startsWith(q)) hits.push({ command, rank: 0 })
    else if (command.fLabel.includes(q)) hits.push({ command, rank: 1 })
    else if (command.haystack.includes(q)) hits.push({ command, rank: 2 })
  }
  return hits.sort((a, b) => a.rank - b.rank).map((hit) => hit.command)
}

export function groupCommands(commands) {
  const byName = new Map()
  for (const command of commands) {
    const items = byName.get(command.group)
    if (items) items.push(command)
    else byName.set(command.group, [command])
  }
  return [...byName].map(([name, items]) => ({ name, items }))
}
