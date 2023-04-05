'use strict'

module.exports = ({ strapi }) => ({
  async index(ctx) {
    let verification = {}
    let formName = strapi.config.get('plugin.ezforms.enableFormName') ? ctx.request.body.formName : 'form'
    // Checks if there is a captcha provider
    if (!(strapi.config.get('plugin.ezforms.captchaProvider.name') === 'none') && (strapi.config.get('plugin.ezforms.captchaProvider.name'))) {
      verification = await strapi.plugin('ezforms').service(strapi.config.get('plugin.ezforms.captchaProvider.name')).validate(ctx.request.body.token)
      //throws error if invalid
      if (!verification.valid) {
        strapi.log.error(verification.error)
        if (verification.code === 500) {
          return ctx.internalServerError('There was an error, check Strapi logs for more details. ' + verification.message)
        } else if (verification.code === 400) {
          return ctx.badRequest(verification.message)
        } else {
          return ctx.internalServerError('There was an error')
        }
      }
    }

    //sends notifications
    for (const provider of strapi.config.get('plugin.ezforms.notificationProviders')) {
      if (provider.enabled) {
        try {
          await strapi.plugin('ezforms').service(provider.name).send(provider.config, formName, ctx.request.body.formData)
        } catch (e) {
          strapi.log.error(e)
          ctx.internalServerError('A Whoopsie Happened')
        }
      }
    }

    // Adds to DB
    let parsedScore = verification.score || -1
    // Regular expressions 
    const nameRegex = /^([A-Za-z]{2,}\s)*[A-Za-z]{2,}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;
    const messageRegex = /^[a-zA-Z]+\b([\w\s'’".,?!-;])*$/;

    try {
      await strapi.query('plugin::ezforms.submission').create({
        data: {
          score: parsedScore,
          formName: formName,
          data: ctx.request.body.formData,
        }
      }
      )
    } catch (e) {
      strapi.log.error(e)
      return ctx.internalServerError('A Whoopsie Happened')
    }
    // Validations
    const data = ctx.request.body.formData

    if (!nameRegex.test(data.name)) {
      return ctx.badRequest('Invalid or incomplete name');
    }
    if (!emailRegex.test(data.email)) {
      return ctx.badRequest('Invalid email');
    }
    if (!phoneRegex.test(data.phone)) {
      return ctx.badRequest('Invalid phone');
    }
    if (!messageRegex.test(data.message)) {
      return ctx.badRequest('Invalid message');
    }

    return ctx.body = 'form submitted succesfully'
  },
})

