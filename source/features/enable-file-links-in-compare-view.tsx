import React from 'dom-chef';
import select from 'select-dom';
import {GitBranchIcon} from '@primer/octicons-react';
import * as pageDetect from 'github-url-detection';
import delegate, {DelegateEvent} from 'delegate-it';

import features from '../feature-manager';
import GitHubURL from '../github-helpers/github-url';
import {getBranches} from '../github-helpers/pr-branches';

/** Rebuilds the "View file" link because it points to the base repo and to the commit, instead of the head repo and its branch */
function handlePRMenuOpening({delegateTarget: dropdown}: DelegateEvent): void {
	dropdown.classList.add('rgh-actionable-link'); // Mark this as processed

	const {nameWithOwner, branch} = getBranches().head;
	const filePath = dropdown.closest('[data-path]')!.getAttribute('data-path')!;

	select('a[data-ga-click^="View file"]', dropdown)!
		.pathname = [nameWithOwner, 'blob', branch, filePath].join('/'); // Do not replace with `GitHubURL`  #3152 #3111 #2595
}

function handleCompareMenuOpening({delegateTarget: dropdown}: DelegateEvent): void {
	dropdown.classList.add('rgh-actionable-link'); // Mark this as processed

	const viewFile = select('a[data-ga-click^="View file"]', dropdown)!;
	const branch = select('[title^="compare"]')!.textContent!;
	viewFile.before(
		<div className="dropdown-header pl-5">
			<GitBranchIcon className="ml-n3 pr-1" height={13}/>
			{branch}
		</div>,
	);

	const url = new GitHubURL(viewFile.href);
	viewFile.href = url.assign({branch}).href;

	// Fix the edit link
	const editFile = viewFile.cloneNode(true);
	editFile.textContent = 'Edit file';
	editFile.removeAttribute('data-ga-click');
	editFile.href = url.assign({route: 'edit'}).href;
	select('[aria-label$="to make changes."]', dropdown)!.replaceWith(editFile);

	// Fix the delete link
	const deleteFile = editFile.cloneNode(true);
	deleteFile.textContent = 'Delete file';
	deleteFile.classList.add('menu-item-danger');
	deleteFile.href = url.assign({route: 'delete'}).href;
	select('[aria-label$="delete this file."]', dropdown)!.replaceWith(deleteFile);
}

function init(signal: AbortSignal): void {
	const handleMenuOpening = pageDetect.isCompare() ? handleCompareMenuOpening : handlePRMenuOpening;
	// `capture: true` required to be fired before GitHub's handlers
	delegate('.file-header:not([data-file-deleted="true"]) .js-file-header-dropdown:not(.rgh-actionable-link)', 'toggle', handleMenuOpening, {capture: true, signal});
}

void features.add(import.meta.url, {
	include: [
		pageDetect.isPRFiles,
		pageDetect.isPRCommit,
	],
	exclude: [
		// Editing files doesn't make sense after a PR is closed/merged
		pageDetect.isClosedPR,
		() => select('.head-ref')!.title === 'This repository has been deleted',
		// If you're viewing changes from partial commits, ensure you're on the latest one.
		() => select.exists('.js-commits-filtered') && !select.exists('[aria-label="You are viewing the latest commit"]'),
	],
	awaitDomReady: true, // DOM-based filters
	init,
}, {
	asLongAs: [
		// Only enable if you can create a PR or view an existing PR, if you can't you are probably looking at a permalink.
		() => select.exists('.existing-pull-button, [data-ga-click*="text:Create pull request"]'),
	],
	include: [
		pageDetect.isCompare,
	],
	awaitDomReady: true, // DOM-based filters
	init,
});

/*

Test URLs

- Open PR: https://github.com/refined-github/sandbox/pull/4/files
- Compare view: https://github.com/refined-github/sandbox/compare/default-a...very-very-long-long-long-long-branch-name

*/
