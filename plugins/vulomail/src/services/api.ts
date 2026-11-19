/* global vulomailAppLocalizer */
import axios, { AxiosError, Method } from 'axios';
import { __ } from '@wordpress/i18n';
import { getApiLink } from '@zyra/core';

/**
 * Thin REST client. Unlike zyra's getApiResponse()/sendApiResponse(), which resolve to `null` on any
 * error, this rejects with the server's own message so a failed save or test can say why.
 */
const request = async <T>(
	method: Method,
	endpoint: string,
	data?: unknown,
	params?: Record<string, string | number | undefined>,
	namespace?: string
): Promise<T> => {
	try {
		const response = await axios.request<T>({
			method,
			url: getApiLink(vulomailAppLocalizer, endpoint, namespace),
			data,
			params,
			headers: { 'X-WP-Nonce': vulomailAppLocalizer.nonce },
		});

		return response.data;
	} catch (error) {
		const message = (error as AxiosError<{ message?: string }>).response
			?.data?.message;

		throw new Error(
			message ||
				__('Something went wrong. Please try again.', 'vulomail'),
			{ cause: error }
		);
	}
};

/** `namespace` reaches another plugin's REST API (Email Templates lists every plugin's emails); VuloMail's own by default. */
export const apiGet = <T>(
	endpoint: string,
	params?: Record<string, string | number | undefined>,
	namespace?: string
) => request<T>('GET', endpoint, undefined, params, namespace);

export const apiPost = <T>(endpoint: string, data: unknown = {}, namespace?: string) =>
	request<T>('POST', endpoint, data, undefined, namespace);

export const apiDelete = <T>(endpoint: string, data?: unknown) =>
	request<T>('DELETE', endpoint, data);
