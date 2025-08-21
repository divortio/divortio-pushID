
export default {
    /**
     * This is the main function that handles every request to your site.
     * @param {Request} request - The incoming request object.
     * @param {object} env - An object containing your environment variables and bindings.
     * @param {object} ctx - The execution context of the request.
     * @returns {Response} - The response to send back to the browser.
     */
    async fetch(request, env, ctx) {

        return env.ASSETS.fetch(request);
    },
};
